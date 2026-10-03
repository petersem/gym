import express from "express";
import { SessionsModel } from "../models/SessionsModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { ActivitiesModel } from "../models/ActivitiesModel.mjs";
import { LocationModel } from "../models/LocationModel.mjs";
import { BookingsModel } from "../models/BookingsModel.mjs";
import { AuthenticationController } from "./AuthenticationController.mjs";
import { body } from "express-validator";
import { management } from "../utilities/formValidation.mjs";

/**
 * Converts a session time from an HTML time input or 12-hour input to MySQL format.
 * @param {unknown} value Session time value.
 * @returns {unknown|string} Normalized time or the original value when it is not parseable.
 */
const normalizeSessionTime = (value) => {
  const normalizedValue = String(value).trim();
  const pickerMatch = normalizedValue.match(/^(\d{1,2}):(\d{2})$/);
  if (pickerMatch) {
    return `${pickerMatch[1].padStart(2, "0")}:${pickerMatch[2]}:00`;
  }

  const match = normalizedValue.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) {
    return value;
  }

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hour !== 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${minute}:00`;
};

const SESSION_SORT_COLUMNS = [
  "title",
  "trainer",
  "date",
  "activity",
  "location",
  "bookings",
];

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
    const trainer = users.find(
      (user) => user.id === Number(session.trainer_id),
    );
    return trainer ? `${trainer.last_name}, ${trainer.first_name}` : "";
  }
  if (sortBy === "activity") {
    return (
      activities.find((item) => Number(item.id) === Number(session.activity_id))
        ?.name ?? ""
    );
  }
  if (sortBy === "location") {
    return (
      locations.find((item) => Number(item.id) === Number(session.location_id))
        ?.name ?? ""
    );
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
const sortSessions = (
  sessions,
  users,
  activities,
  locations,
  sortBy,
  sortDir,
) => {
  const multiplier = sortDir === "desc" ? -1 : 1;
  return [...sessions].sort(
    (left, right) =>
      String(
        sessionSortValue(left, users, activities, locations, sortBy),
      ).localeCompare(
        String(sessionSortValue(right, users, activities, locations, sortBy)),
        undefined,
        { numeric: true, sensitivity: "base" },
      ) * multiplier,
  );
};

/** HTTP handlers for sessions. */
export class SessionsController {
  /** @type {express.Router} */
  static routes = express.Router();

  /**
   * Validation for the session management form. Field rules run for create
   * and update only, and new sessions cannot be dated before today.
   * @type {express.RequestHandler[]}
   */
  static formValidation = management(
    "/sessions",
    ["title", "activityId", "locationId", "trainerId", "date", "time"],
    [
      body("title")
        .isString()
        .withMessage("Title must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Title must contain 1-200 characters."),
      body("activityId")
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Activity must be a valid number.")
        .bail()
        .isInt({ min: 1, max: 2147483647, allow_leading_zeroes: false })
        .withMessage("Activity must be an integer between 1 and 2147483647."),
      body("locationId")
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Location must be a valid number.")
        .bail()
        .isInt({ min: 1, max: 2147483647, allow_leading_zeroes: false })
        .withMessage("Location must be an integer between 1 and 2147483647."),
      body("trainerId")
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Trainer must be a valid number.")
        .bail()
        .isInt({ min: 1, max: 2147483647, allow_leading_zeroes: false })
        .withMessage("Trainer must be an integer between 1 and 2147483647."),
      body("date")
        .customSanitizer((value) => (value === "" ? null : value))
        .isString()
        .withMessage("Date must be a date.")
        .bail()
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("Date must use YYYY-MM-DD.")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("Date must be a real calendar date.")
        .bail()
        // Existing sessions may already be in the past, so only new ones are checked.
        .custom((value, { req }) => {
          if (req.body.action !== "create") {
            return true;
          }
          const now = new Date();
          const today = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
          ].join("-");
          return value >= today;
        })
        .withMessage("Date cannot be earlier than today."),
      body("time")
        .isString()
        .withMessage("Time must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 11 })
        .withMessage("Time must contain 1-11 characters.")
        .bail()
        // Accepts 24-hour picker values (HH:MM or HH:MM:SS) and 12-hour times (h:mm am/pm).
        .custom((value) => {
          const picker = value.match(/^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/);
          if (picker) {
            return Number(picker[1]) <= 23;
          }
          const clock = value.match(/^(\d{1,2}):([0-5]\d)\s*(am|pm)$/i);
          return Boolean(
            clock && Number(clock[1]) >= 1 && Number(clock[1]) <= 12,
          );
        })
        .withMessage("Time must be a valid 24-hour or AM/PM time."),
    ],
    {
      activityId: "activity_id",
      locationId: "location_id",
      trainerId: "trainer_id",
    },
  );

  static {
    this.routes.get(
      "/",
      AuthenticationController.restrict(["admin", "trainer"]),
      this.viewSessionManagement,
    );
    this.routes.get(
      "/:id",
      AuthenticationController.restrict(["admin", "trainer"]),
      this.viewSessionManagement,
    );
    this.routes.post(
      "/",
      AuthenticationController.restrict(["admin", "trainer"]),
      this.formValidation,
      this.handleSessionManagement,
    );
    this.routes.post(
      "/:id",
      AuthenticationController.restrict(["admin", "trainer"]),
      this.formValidation,
      this.handleSessionManagement,
    );
  }

  /**
   * Renders the session management page with sessions for the next seven days,
   * filtered by search term and trainer, and loads the session in the URL into
   * the edit form.
   * @type {express.RequestHandler}
   */
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
        const selectedTrainerId =
          req.authenticatedUser?.role === "trainer"
            ? Number(req.authenticatedUser.id)
            : Number(req.query.trainer_id) || null;
        const selectedSearchTerm = String(req.query.search_term ?? "").trim();
        const normalizedSearchTerm = selectedSearchTerm.toLocaleLowerCase();
        const selectedSortBy = SESSION_SORT_COLUMNS.includes(req.query.sort_by)
          ? req.query.sort_by
          : "date";
        const selectedSortDir = req.query.sort_dir === "desc" ? "desc" : "asc";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastDate = new Date(today);
        lastDate.setDate(lastDate.getDate() + 7);
        const toLocalDateValue = (date) =>
          [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0"),
          ].join("-");
        const firstDateValue = toLocalDateValue(today);
        const lastDateValue = toLocalDateValue(lastDate);
        const filteredSessions = sessions.filter(
          (session) =>
            String(session.date).slice(0, 10) >= firstDateValue &&
            String(session.date).slice(0, 10) <= lastDateValue &&
            (!selectedLocationId ||
              Number(session.location_id) === selectedLocationId) &&
            (!selectedTrainerId ||
              Number(session.trainer_id) === selectedTrainerId) &&
            (!normalizedSearchTerm ||
              String(session.title)
                .toLocaleLowerCase()
                .includes(normalizedSearchTerm)),
        );
        const sessionBookingCounts = bookings.reduce((counts, booking) => {
          const sessionId = Number(booking.session_id);
          if (!Number.isFinite(sessionId)) {
            return counts;
          }
          counts.set(sessionId, (counts.get(sessionId) ?? 0) + 1);
          return counts;
        }, new Map());
        const sessionsWithBookingCounts = filteredSessions.map((session) => ({
          ...session,
          totalBookedUsers: sessionBookingCounts.get(Number(session.id)) ?? 0,
        }));
        const sortedSessions = sortSessions(
          sessionsWithBookingCounts,
          users,
          activities,
          locations,
          selectedSortBy,
          selectedSortDir,
        );
        const pageSize = 7;
        const selectedPage = Math.max(1, Number(req.query.page) || 1);
        const totalPages = Math.max(
          1,
          Math.ceil(sortedSessions.length / pageSize),
        );
        const paginatedSessions = sortedSessions.slice(
          (selectedPage - 1) * pageSize,
          selectedPage * pageSize,
        );
        const selectedSession =
          sessions.find((session) => String(session.id) === req.params.id) ??
          new SessionsModel(null, 0, 0, 0, "", "", "");
        return (
          selectedSession.id
            ? BookingsModel.getBySessionId(selectedSession.id)
            : Promise.resolve([])
        ).then((selectedSessionBookings) => {
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
        res.status(500).render("status.ejs", {
          status: "Database Error",
          message: "Sessions could not be loaded.",
        });
      });
  }

  /**
   * Creates, updates or deletes a session from the validated management form.
   * @type {express.RequestHandler}
   */
  static handleSessionManagement(req, res) {
    const title = req.body.title;
    const activityId = req.body.activityId ?? req.body.activity_id;
    const locationId = req.body.locationId ?? req.body.location_id;
    const trainerId = req.body.trainerId ?? req.body.trainer_id;
    const { date, time } = req.body;
    const session = new SessionsModel(
      req.params.id ? Number(req.params.id) : null,
      Number(activityId),
      Number(locationId),
      Number(trainerId),
      date,
      normalizeSessionTime(time),
      req.body.action === "delete" ? undefined : title.trim(),
    );

    if (req.body.action === "create") {
      return SessionsModel.create(session)
        .then(() => res.redirect("/sessions"))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The session could not be created.",
          });
        });
    } else if (req.body.action === "update") {
      return SessionsModel.update(session)
        .then(() => res.redirect("/sessions"))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The session could not be updated.",
          });
        });
    } else if (req.body.action === "delete") {
      return BookingsModel.deleteBySessionId(session.id)
        .then(() => SessionsModel.delete(session.id))
        .then(() => res.redirect("/sessions"))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The session could not be deleted.",
          });
        });
    } else {
      res.status(400).render("status.ejs", {
        status: "Invalid Action",
        message: "The form doesn't support this action.",
      });
    }
  }

  /** @type {express.RequestHandler} */
  static async list(req, res, next) {
    try {
      res.json(await SessionsModel.getAll());
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async getById(req, res, next) {
    try {
      res.json(await SessionsModel.getById(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async create(req, res, next) {
    try {
      res.status(201).json(await SessionsModel.create(req.body));
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async update(req, res, next) {
    try {
      res.json(
        await SessionsModel.update({ ...req.body, id: Number(req.params.id) }),
      );
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async delete(req, res, next) {
    try {
      res.json(await SessionsModel.delete(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  }
}
