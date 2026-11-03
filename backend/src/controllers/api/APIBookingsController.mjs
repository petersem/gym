import express from "express";
import { UsersModel } from "../../models/UsersModel.mjs";
import { SessionsModel } from "../../models/SessionsModel.mjs";
import { BookingsModel } from "../../models/BookingsModel.mjs";
import { DatabaseModel } from "../../models/DatabaseModel.mjs";
import { APIAuthenticationController } from "./APIAuthenticationController.mjs";
import { APIError, activeRecord, publicRecord } from "./apiHelpers.mjs";
import {
  bookingXmlRecord,
  bookingsDtd,
  bookingsXmlContent,
  buildXmlDocument,
  sendXmlDocument,
} from "../../utilities/xmlExport.mjs";
import {
  buildResourcePaths,
  createResourceRouter,
  xmlExportPath,
} from "./apiResourceFactory.mjs";
import { pastSessions, xmlLookups } from "./apiSessionQueries.mjs";

/**
 * Configuration for the `/bookings` resource: members create and cancel their
 * own bookings; trainers can read bookings for their own sessions.
 */
const bookingsResource = {
  path: "bookings",
  schema: "Booking",
  tag: "Bookings",
  model: BookingsModel,
  roles: ["member"],
  getRoles: ["trainer", "member"],
  putRoles: [],
  conflicts: { create: "BookingConflict" },
  query: {
    searchDescription: "session title",
    sorts: ["session_date", "session", "member", "created"],
    defaultSort: "session_date",
    defaultDir: "asc",
  },
  description:
    "Members can read, create and cancel only their own bookings, but cannot update bookings. Trainers can read bookings only for sessions assigned to them; they cannot create, update or cancel bookings. Duplicate and overlapping bookings return 409.",

  /**
   * List a member's own bookings, or bookings for a trainer's sessions.
   *
   * @param {express.Request} req Request containing the authenticated user.
   * @returns {Promise<object[]>} Bookings visible to the user.
   */
  async loadList(req) {
    if (req.authenticatedUser.role !== "trainer") {
      return BookingsModel.getByUserId(req.authenticatedUser.id);
    }
    const [bookings, sessions] = await Promise.all([
      BookingsModel.getAll(),
      SessionsModel.getAll(),
    ]);
    const sessionIds = new Set(
      sessions
        .filter(
          (session) =>
            Number(session.trainer_id) === Number(req.authenticatedUser.id),
        )
        .map((session) => Number(session.id)),
    );
    return bookings.filter((booking) =>
      sessionIds.has(Number(booking.session_id)),
    );
  },

  /**
   * Resolve the searchable and sortable values of a booking.
   *
   * @returns {Promise<function(object): object>} Booking field mapper.
   */
  async fields() {
    const [sessions, users] = await Promise.all([
      SessionsModel.getAll(),
      UsersModel.getAll(),
    ]);
    const sessionById = new Map(sessions.map((s) => [Number(s.id), s]));
    const userById = new Map(users.map((u) => [Number(u.id), u]));
    return (booking) => {
      const session = sessionById.get(Number(booking.session_id)) ?? {};
      const member = userById.get(Number(booking.user_id));
      const date =
        session.date instanceof Date
          ? DatabaseModel.toMySqlDate(session.date)
          : String(session.date ?? "").slice(0, 10);
      return {
        search: [session.title],
        session_date: `${date} ${session.time ?? ""}`,
        session: session.title,
        member: member ? `${member.last_name}, ${member.first_name}` : "",
        created: new Date(booking.created).toISOString(),
      };
    };
  },

  /**
   * Allow members to access their own bookings and trainers to access
   * bookings for their own sessions.
   *
   * @param {{id: number|string, role: string}} user Authenticated user.
   * @param {object} record Booking record.
   * @returns {Promise<void>}
   * @throws {APIError} If the booking is outside the user's permitted scope.
   */
  async authorize(user, record) {
    if (user.role === "trainer") {
      const session = await activeRecord(SessionsModel, record.session_id);
      if (Number(session.trainer_id) !== Number(user.id)) {
        throw new APIError(
          403,
          "You can only view bookings for your own sessions.",
        );
      }
      return;
    }
    if (Number(record.user_id) !== Number(user?.id)) {
      throw new APIError(403, "You can only manage your own records.");
    }
  },

  /**
   * Validate a new booking and set server-managed fields.
   *
   * @param {express.Request} req Request containing the authenticated user and body.
   * @param {object} [existing] Existing booking, if any.
   * @returns {Promise<object>} Booking ready to be written.
   * @throws {APIError} If the member, session or ownership is invalid.
   */
  async prepare(req, existing) {
    const user = req.authenticatedUser;
    const record = { ...existing, ...req.body, id: existing?.id ?? null };
    record.user_id ??= user.id;
    if (user.role === "member" && Number(record.user_id) !== Number(user.id)) {
      throw new APIError(403, "Members can only book for themselves.");
    }
    const member = await activeRecord(UsersModel, record.user_id);
    if (member.role !== "member") {
      throw new APIError(400, "Select an existing member.");
    }
    const session = await activeRecord(SessionsModel, record.session_id);
    if (session.date < DatabaseModel.toMySqlDate(new Date())) {
      throw new APIError(400, "Cannot book a past session.");
    }
    record.created = existing?.created ?? new Date();
    return record;
  },
};

/**
 * Registers API routes for bookings and the member bookings XML export.
 */
export class APIBookingsController {
  static routes = express.Router();

  /**
   * OpenAPI path definitions for the booking endpoints.
   *
   * @type {Record<string, object>}
   */
  static paths = {
    ...buildResourcePaths(bookingsResource),
    "/api/v1/bookings/xml": xmlExportPath({
      tag: "Bookings",
      operationId: "exportBookingsXml",
      summary: "Download your past bookings as XML",
      description:
        "Members download all of their own bookings for sessions that have already taken place, with session, activity, trainer and location details. Guests, trainers and administrators have no access.",
      root: "gymBookings",
      filename: "gym-bookings.xml",
    }),
  };

  static {
    this.routes.get(
      "/bookings/xml",
      APIAuthenticationController.restrict(["member"]),
      this.exportBookingsXml,
    );
    this.routes.use("/bookings", createResourceRouter(bookingsResource));
  }

  /**
   * Send the authenticated member's bookings for past sessions as XML.
   *
   * @type {express.RequestHandler}
   */
  static async exportBookingsXml(req, res) {
    const [sessions, bookings, lookups] = await Promise.all([
      pastSessions(),
      BookingsModel.getByUserId(req.authenticatedUser.id),
      xmlLookups(),
    ]);
    const sessionsById = new Map(
      sessions.map((session) => [Number(session.id), session]),
    );
    const sessionOrder = new Map(
      sessions.map((session, index) => [Number(session.id), index]),
    );
    const booking = bookings
      .filter((item) => sessionsById.has(Number(item.session_id)))
      .map(publicRecord)
      .sort(
        (a, b) =>
          sessionOrder.get(Number(a.session_id)) -
            sessionOrder.get(Number(b.session_id)) ||
          Number(a.id) - Number(b.id),
      )
      .map((item) =>
        bookingXmlRecord(
          item,
          sessionsById.get(Number(item.session_id)),
          lookups,
        ),
      );
    sendXmlDocument(
      res,
      "gym-bookings.xml",
      buildXmlDocument("gymBookings", bookingsXmlContent(booking), bookingsDtd),
    );
  }
}
