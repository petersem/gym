import express from "express";
import { SessionsModel } from "../models/SessionsModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { ActivitiesModel } from "../models/ActivitiesModel.mjs";
import { LocationModel } from "../models/LocationModel.mjs";
import { BookingsModel } from "../models/BookingsModel.mjs";
import { AuthenticationController } from "./AuthenticationController.mjs";

/**
 * Converts a session time from an HTML time input or 12-hour input to MySQL format.
 * @param {unknown} value Session time value.
 * @returns {unknown|string} Normalized time or the original value when it is not parseable.
 */
const normalizeSessionTime = (value) => {
  const normalizedValue = String(value).trim();
  const pickerMatch = normalizedValue.match(/^(\d{1,2}):(\d{2})$/);
  if (pickerMatch) return `${pickerMatch[1].padStart(2, "0")}:${pickerMatch[2]}:00`;

  const match = normalizedValue.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}:00`;
};

/**
 * Checks whether a value represents a positive numeric identifier.
 * @param {unknown} value Candidate identifier.
 * @returns {boolean} Whether the identifier is positive and integral.
 */
const isPositiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const SESSION_SORT_COLUMNS = ["title", "trainer", "date", "activity", "location", "bookings"];

/**
 * Gets the value used to sort a session by the selected column.
 * @param {object} session Session record.
 * @param {object[]} users User records.
 * @param {object[]} activities Activity records.
 * @param {object[]} locations Location records.
 * @param {string} sortBy Sort column.
 * @returns {string|number} Comparable sort value.
 */
// Compute a comparable sort value for a session given its related records.
const sessionSortValue = (session, users, activities, locations, sortBy) => {
  if (sortBy === "trainer") {
    const trainer = users.find((user) => user.id === Number(session.trainer_id));
    return trainer ? `${trainer.last_name}, ${trainer.first_name}` : "";
  }
  if (sortBy === "activity") {
    return activities.find((item) => Number(item.id) === Number(session.activity_id))?.name ?? "";
  }
  if (sortBy === "location") {
    return locations.find((item) => Number(item.id) === Number(session.location_id))?.name ?? "";
  }
  if (sortBy === "date") {
    return `${String(session.date).slice(0, 10)} ${String(session.time).slice(0, 8)}`;
  }
  if (sortBy === "bookings") {
    return Number(session.totalBookedUsers);
  }
  return session.title;
};

/**
 * Sorts sessions by a supported column and direction.
 * @param {object[]} sessions Session records.
 * @param {object[]} users User records.
 * @param {object[]} activities Activity records.
 * @param {object[]} locations Location records.
 * @param {string} sortBy Sort column.
 * @param {"asc"|"desc"} sortDir Sort direction.
 * @returns {object[]} Sorted session records.
 */
// Sort sessions server-side using the given column and direction.
const sortSessions = (sessions, users, activities, locations, sortBy, sortDir) => {
  const multiplier = sortDir === "desc" ? -1 : 1;
  return [...sessions].sort((left, right) => (
    String(sessionSortValue(left, users, activities, locations, sortBy)).localeCompare(
      String(sessionSortValue(right, users, activities, locations, sortBy)),
      undefined,
      { numeric: true, sensitivity: "base" },
    ) * multiplier
  ));
};

/** HTTP handlers for sessions. */
export class SessionsController {
  /** @type {import("express").Router} */
  static routes = express.Router();

  static {
    this.routes.get("/",
      AuthenticationController.restrict(["admin", "trainer"]),
      this.viewSessionManagement);
    this.routes.get("/:id",
      AuthenticationController.restrict(["admin", "trainer"]),
      this.viewSessionManagement);
    this.routes.post("/",
      AuthenticationController.restrict(["admin", "trainer"]),
      this.handleSessionManagement);
    this.routes.post("/:id",
      AuthenticationController.restrict(["admin", "trainer"]),
      this.handleSessionManagement);
  }

  /** @type {import("express").RequestHandler} */
  static viewSessionManagement(req, res) {
    return Promise.all([
      SessionsModel.getAll(),
      UsersModel.getAll(),
      ActivitiesModel.getAll(),
      LocationModel.getAll(),
      BookingsModel.getAll(),
    ])
      .then(([sessions, users, activities, locations, bookings]) => {
      const selectedLocationId = Number(req.query.location_id) || null;
      const selectedTrainerId = req.authenticatedUser?.role === "trainer"
        ? Number(req.authenticatedUser.id)
        : Number(req.query.trainer_id) || null;
      const selectedSearchTerm = String(req.query.search_term ?? "").trim();
      const normalizedSearchTerm = selectedSearchTerm.toLocaleLowerCase();
      const selectedSortBy = SESSION_SORT_COLUMNS.includes(req.query.sort_by) ? req.query.sort_by : "date";
      const selectedSortDir = req.query.sort_dir === "desc" ? "desc" : "asc";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastDate = new Date(today);
      lastDate.setDate(lastDate.getDate() + 7);
      const toLocalDateValue = (date) => [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
      const firstDateValue = toLocalDateValue(today);
      const lastDateValue = toLocalDateValue(lastDate);
      const filteredSessions = sessions.filter((session) => (
        String(session.date).slice(0, 10) >= firstDateValue
        && String(session.date).slice(0, 10) <= lastDateValue
        &&
        (!selectedLocationId || Number(session.location_id) === selectedLocationId)
        && (!selectedTrainerId || Number(session.trainer_id) === selectedTrainerId)
        && (!normalizedSearchTerm || String(session.title).toLocaleLowerCase().includes(normalizedSearchTerm))
      ));
      const sessionBookingCounts = bookings.reduce((counts, booking) => {
        const sessionId = Number(booking.session_id);
        if (!Number.isFinite(sessionId)) return counts;
        counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
        return counts;
      }, new Map());
      const sessionsWithBookingCounts = filteredSessions.map((session) => ({
        ...session,
        totalBookedUsers: sessionBookingCounts.get(Number(session.id)) ?? 0,
      }));
      const sortedSessions = sortSessions(sessionsWithBookingCounts, users, activities, locations, selectedSortBy, selectedSortDir);
      const pageSize = 7;
      const selectedPage = Math.max(1, Number(req.query.page) || 1);
      const totalPages = Math.max(1, Math.ceil(sortedSessions.length / pageSize));
      const paginatedSessions = sortedSessions.slice((selectedPage - 1) * pageSize, selectedPage * pageSize);
      const selectedSession = sessions.find((session) => session.id == req.params.id)
        ?? new SessionsModel(null, 0, 0, 0, "", "", "");
      return (selectedSession.id ? BookingsModel.getBySessionId(selectedSession.id) : Promise.resolve([]))
        .then((selectedSessionBookings) => {
          res.render("session_management.ejs", {
            sessions: paginatedSessions,
            users,
            activities,
            locations,
            selectedSession,
            selectedSessionHasBookings: selectedSessionBookings.length > 0,
            selectedLocationId,
            selectedTrainerId,
            selectedSearchTerm,
            selectedSortBy,
            selectedSortDir,
            selectedPage,
            totalPages,
            authenticatedUser: req.authenticatedUser,
            role: "admin",
          });
        });
      })
      .catch((error) => {
        console.error(error);
        res.status(500).render("status.ejs", { status: "Database Error", message: "Sessions could not be loaded." });
      });
  }

  /** @type {import("express").RequestHandler} */
  static handleSessionManagement(req, res) {
    const title = req.body.title;
    const activityId = req.body.activityId ?? req.body.activity_id;
    const locationId = req.body.locationId ?? req.body.location_id;
    const trainerId = req.body.trainerId ?? req.body.trainer_id;
    const { date, time } = req.body;
    if ([title, activityId, locationId, trainerId, date, time]
      .some((field) => !String(field ?? "").trim())) {
      return res.status(400).render("status.ejs", {
        status: "Invalid Session",
        message: "All session fields are required.",
      });
    }

    if (![activityId, locationId, trainerId].every(isPositiveId)) {
      return res.status(400).render("status.ejs", {
        status: "Invalid Session",
        message: "Activity, location, and trainer must be valid selections.",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}(?::\d{2})?$/.test(time) && !/^\d{1,2}:\d{2}\s*(am|pm)$/i.test(time)) {
      return res.status(400).render("status.ejs", {
        status: "Invalid Session",
        message: "Date and time must be valid.",
      });
    }

    const session = new SessionsModel(
      req.params.id ? Number(req.params.id) : null,
      Number(activityId),
      Number(locationId),
      Number(trainerId),
      date,
      normalizeSessionTime(time),
      title.trim(),
    );

    if (req.body.action === "create") {
      return SessionsModel.create(session)
        .then(() => res.redirect("/sessions"))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", { status: "Database Error", message: "The session could not be created." });
        });
    } else if (req.body.action === "update") {
      return SessionsModel.update(session)
        .then(() => res.redirect("/sessions"))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", { status: "Database Error", message: "The session could not be updated." });
        });
    } else if (req.body.action === "delete") {
      return BookingsModel.deleteBySessionId(session.id)
        .then(() => SessionsModel.delete(session.id))
        .then(() => res.redirect("/sessions"))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", { status: "Database Error", message: "The session could not be deleted." });
        });
    } else {
      res.status(400).render("status.ejs", { status: "Invalid Action", message: "The form doesn't support this action." });
    }
  }

  /** @type {import("express").RequestHandler} */
  static async list(req, res, next) {
    try { res.json(await SessionsModel.getAll()); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async getById(req, res, next) {
    try { res.json(await SessionsModel.getById(Number(req.params.id))); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async create(req, res, next) {
    try { res.status(201).json(await SessionsModel.create(req.body)); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async update(req, res, next) {
    try { res.json(await SessionsModel.update({ ...req.body, id: Number(req.params.id) })); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async delete(req, res, next) {
    try { res.json(await SessionsModel.delete(Number(req.params.id))); }
    catch (error) { next(error); }
  }
}