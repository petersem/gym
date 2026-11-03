import express from "express";
import { UsersModel } from "../../models/UsersModel.mjs";
import { LocationModel } from "../../models/LocationModel.mjs";
import { SessionsModel } from "../../models/SessionsModel.mjs";
import { BookingsModel } from "../../models/BookingsModel.mjs";
import { APIAuthenticationController } from "./APIAuthenticationController.mjs";
import { APIError } from "./apiHelpers.mjs";
import {
  buildXmlDocument,
  sendXmlDocument,
  sessionXmlRecord,
  sessionsDtd,
  sessionsXmlContent,
} from "../../utilities/xmlExport.mjs";
import {
  buildResourcePaths,
  createResourceRouter,
  errorResponses,
  queryParameters,
  ref,
  response,
  searchAndSort,
  xmlExportPath,
} from "./apiResourceFactory.mjs";
import { upcomingSessions, xmlLookups } from "./apiSessionQueries.mjs";

/**
 * Configuration for the `/sessions` resource: trainers can delete only their
 * own sessions.
 */
const sessionsResource = {
  path: "sessions",
  removedMethods: ["post", "get", "put"],
  list: false,
  schema: "Session",
  tag: "Sessions",
  model: SessionsModel,
  roles: [],
  deleteRoles: ["trainer"],
  description:
    "Trainers can delete only their own sessions; sessions cannot be listed, read, created or updated through this resource. Members and trainers use the timetable to browse sessions. Deleting a session also removes its bookings.",

  /**
   * Allow trainers to access only sessions assigned to them.
   *
   * @param {{id: number|string}} user Authenticated user.
   * @param {object} record Session record.
   * @throws {APIError} If the session belongs to another trainer.
   */
  authorize(user, record) {
    if (Number(record.trainer_id) !== Number(user?.id)) {
      throw new APIError(403, "You can only manage your own records.");
    }
  },

  /**
   * Remove a session's bookings before the session is deleted.
   *
   * @param {{id: number|string}} record Session record being deleted.
   * @returns {Promise<void>}
   */
  async beforeDelete(record) {
    await BookingsModel.deleteBySessionId(record.id);
  },
};

/**
 * Search and sort configuration for the `/timetable` endpoint.
 */
const timetable = {
  path: "timetable",
  query: {
    searchDescription: "session title only",
    sorts: ["date", "title", "trainer", "location"],
    defaultSort: "date",
    defaultDir: "asc",
  },

  /**
   * Resolve the searchable and sortable values of a session.
   *
   * @returns {Promise<function(object): object>} Session field mapper.
   */
  async fields() {
    const [users, locations] = await Promise.all([
      UsersModel.getAll(),
      LocationModel.getAll(),
    ]);
    const userById = new Map(users.map((u) => [Number(u.id), u]));
    const locationById = new Map(locations.map((l) => [Number(l.id), l]));
    return (session) => {
      const trainer = userById.get(Number(session.trainer_id));
      const location = locationById.get(Number(session.location_id));
      const trainerName = trainer
        ? `${trainer.last_name}, ${trainer.first_name}`
        : "";
      return {
        search: [session.title],
        date: `${session.date} ${session.time}`,
        title: session.title,
        trainer: trainerName,
        location: location?.name ?? "",
      };
    };
  },
};

/**
 * Registers API routes for the session timetable, session deletion, and the
 * trainer sessions XML export.
 */
export class APISessionsController {
  static routes = express.Router();

  /**
   * OpenAPI path definitions for the session endpoints.
   *
   * @type {Record<string, object>}
   */
  static paths = {
    ...buildResourcePaths(sessionsResource),
    "/api/v1/timetable": {
      get: {
        tags: ["Sessions"],
        operationId: "getTimetable",
        summary: "Browse, search and sort the next seven days of sessions",
        description:
          "Authenticated members and trainers can browse, search and sort the next seven days of sessions. Guests and administrators have no timetable access.",
        security: [{ ApiKey: [] }],
        parameters: [
          ...["location_id", "trainer_id"].map((name) => ({
            name,
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 2147483647 },
            description: `Filter by ${name.replace("_id", "")}.`,
          })),
          ...queryParameters(timetable.query),
        ],
        responses: {
          200: response(
            { type: "array", items: ref("Session") },
            "Upcoming sessions, ordered by date and time unless sort_by is given.",
          ),
          ...errorResponses(400, 401, 403, 500, 503),
        },
      },
    },
    "/api/v1/sessions/xml": xmlExportPath({
      tag: "Sessions",
      operationId: "exportSessionsXml",
      summary: "Download your sessions for the next seven days as XML",
      description:
        "Trainers download their own sessions in the next seven days, with activity, trainer and location details. Bookings are not included. Guests, members and administrators have no access.",
      root: "gymSessions",
      filename: "gym-sessions.xml",
    }),
  };

  static {
    this.routes.get(
      "/timetable",
      APIAuthenticationController.restrict(["member", "trainer"]),
      this.getTimetable,
    );
    this.routes.get(
      "/sessions/xml",
      APIAuthenticationController.restrict(["trainer"]),
      this.exportSessionsXml,
    );
    this.routes.use("/sessions", createResourceRouter(sessionsResource));
  }

  /**
   * List upcoming sessions, optionally filtered by location and trainer, then
   * searched and sorted.
   *
   * @type {express.RequestHandler}
   */
  static async getTimetable(req, res) {
    const sessions = (await upcomingSessions()).filter(
      (session) =>
        (!req.query.location_id ||
          Number(session.location_id) === Number(req.query.location_id)) &&
        (!req.query.trainer_id ||
          Number(session.trainer_id) === Number(req.query.trainer_id)),
    );
    res.json(await searchAndSort(timetable, sessions, req.query));
  }

  /**
   * Send the authenticated trainer's sessions for the next seven days as XML.
   *
   * @type {express.RequestHandler}
   */
  static async exportSessionsXml(req, res) {
    const [sessions, lookups] = await Promise.all([
      upcomingSessions(),
      xmlLookups(),
    ]);
    const session = sessions
      .filter(
        (item) => Number(item.trainer_id) === Number(req.authenticatedUser.id),
      )
      .map((item) => sessionXmlRecord(item, lookups));
    sendXmlDocument(
      res,
      "gym-sessions.xml",
      buildXmlDocument("gymSessions", sessionsXmlContent(session), sessionsDtd),
    );
  }
}
