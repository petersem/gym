import express from "express";
import { BookingsModel } from "../models/BookingsModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { SessionsModel } from "../models/SessionsModel.mjs";
import { LocationModel } from "../models/LocationModel.mjs";
import { ActivitiesModel } from "../models/ActivitiesModel.mjs";

/**
 * Builds the bookings management URL while preserving the active filters.
 * @param {express.Request} req Current request.
 * @param {Object} [options] Result flags.
 * @returns {string} Bookings page URL.
 */
const bookingPageUrl = (
  req,
  { bookingDeleted = false, bookingCreated = false } = {},
) => {
  const query = new URLSearchParams();
  if (req.query.booking_user_id === "all") {
    query.set("booking_user_id", "all");
  } else {
    const bookingUserId = Number(req.query.booking_user_id);
    if (Number.isInteger(bookingUserId) && bookingUserId > 0) {
      query.set("booking_user_id", String(bookingUserId));
    }
  }
  if (req.query.booking_trainer_id === "all") {
    query.set("booking_trainer_id", "all");
  } else {
    const bookingTrainerId = Number(req.query.booking_trainer_id);
    if (Number.isInteger(bookingTrainerId) && bookingTrainerId > 0) {
      query.set("booking_trainer_id", String(bookingTrainerId));
    }
  }
  if (bookingDeleted) {
    query.set("booking_deleted", "1");
  }
  if (bookingCreated) {
    query.set("booking_created", "1");
  }
  const search = query.toString();
  return search ? `/bookings?${search}` : "/bookings";
};

/** HTTP handlers for bookings. */
export class BookingsController {
  /** @type {express.Router} */
  static routes = express.Router();

  static {
    this.routes.get("/", this.viewBookingManagement);
    this.routes.get("/:id", this.viewBookingManagement);
    this.routes.post("/", this.handleBookingManagement);
    this.routes.post("/:id", this.handleBookingManagement);
  }

  /** @type {express.RequestHandler} */
  static viewBookingManagement(req, res) {
    const canManageBookings = ["admin", "trainer"].includes(
      req.authenticatedUser?.role,
    );
    const bookingsPromise = canManageBookings
      ? BookingsModel.getAll()
      : req.authenticatedUser?.id
        ? BookingsModel.getByUserId(req.authenticatedUser.id)
        : Promise.resolve([]);
    return Promise.all([
      bookingsPromise,
      UsersModel.getAll(),
      SessionsModel.getAll(),
      LocationModel.getAll(),
      ActivitiesModel.getAll(),
    ])
      .then(([bookings, users, sessions, locations, activities]) => {
        const selectedBooking =
          bookings.find((booking) => String(booking.id) === req.params.id) ??
          new BookingsModel(null, req.query.session_id ?? "", 0, "");
        const availableLocationId =
          Number(req.query.available_location_id) || null;
        const bookingLocationId = Number(req.query.booking_location_id) || null;
        const bookingUserIdParam = req.query.booking_user_id;
        const bookingTrainerIdParam = req.query.booking_trainer_id;
        const bookingUserId = canManageBookings
          ? bookingUserIdParam === undefined
            ? req.authenticatedUser?.role === "trainer" ||
              bookingTrainerIdParam !== undefined
              ? null
              : (req.authenticatedUser?.id ?? null)
            : bookingUserIdParam === "all"
              ? null
              : Number(bookingUserIdParam) || null
          : (req.authenticatedUser?.id ?? null);
        const bookingTrainerId = canManageBookings
          ? bookingTrainerIdParam === undefined
            ? req.authenticatedUser?.role === "trainer"
              ? (req.authenticatedUser.id ?? null)
              : null
            : bookingTrainerIdParam === "all"
              ? null
              : Number(bookingTrainerIdParam) || null
          : null;
        const availableSessions = availableLocationId
          ? sessions.filter(
              (session) => Number(session.location_id) === availableLocationId,
            )
          : sessions;
        const bookingSessions = sessions.filter((session) => {
          const matchesLocation =
            !bookingLocationId ||
            Number(session.location_id) === bookingLocationId;
          // A trainer's own bookings stay visible even under sessions taught by other trainers.
          const isOwnBooking =
            req.authenticatedUser?.role === "trainer" &&
            bookings.some(
              (booking) =>
                Number(booking.session_id) === Number(session.id) &&
                Number(booking.user_id) === Number(req.authenticatedUser.id),
            );
          const matchesTrainer =
            !bookingTrainerId ||
            Number(session.trainer_id) === Number(bookingTrainerId) ||
            isOwnBooking;
          return matchesLocation && matchesTrainer;
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const byTime = (left, right) =>
          String(left.time).localeCompare(String(right.time));
        const calendarDays = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(today);
          date.setDate(today.getDate() + index);
          const dateValue = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0"),
          ].join("-");
          const daySessions = availableSessions
            .filter(
              (session) => String(session.date).slice(0, 10) === dateValue,
            )
            .sort(byTime);
          return {
            dateValue,
            label: `${date.toLocaleDateString("en-AU", { weekday: "short" }).slice(0, 3)} ${date.getDate()} ${date.toLocaleDateString("en-AU", { month: "short" }).slice(0, 3)}`,
            bookings: bookings
              .filter((booking) =>
                daySessions.some(
                  (session) => session.id === Number(booking.session_id),
                ),
              )
              .sort((left, right) =>
                byTime(
                  daySessions.find(
                    (session) => session.id === Number(left.session_id),
                  ),
                  daySessions.find(
                    (session) => session.id === Number(right.session_id),
                  ),
                ),
              ),
            sessions: daySessions,
          };
        });
        const bookingCalendarDays = calendarDays
          .map((day) => ({
            ...day,
            sessions: bookingSessions
              .filter(
                (session) =>
                  String(session.date).slice(0, 10) === day.dateValue,
              )
              .sort(byTime),
          }))
          .map((day) => ({
            ...day,
            bookings: bookings
              .filter(
                (booking) =>
                  day.sessions.some(
                    (session) => session.id === Number(booking.session_id),
                  ) &&
                  (!bookingUserId ||
                    Number(booking.user_id) === Number(bookingUserId)),
              )
              .sort((left, right) =>
                byTime(
                  day.sessions.find(
                    (session) => session.id === Number(left.session_id),
                  ),
                  day.sessions.find(
                    (session) => session.id === Number(right.session_id),
                  ),
                ),
              ),
          }));
        res.render("booking_management.ejs", {
          bookings,
          users,
          sessions: availableSessions,
          locations,
          activities,
          calendarDays,
          bookingCalendarDays,
          selectedBooking,
          availableLocationId,
          bookingLocationId,
          bookingTrainerId,
          bookingUserId,
          canManageBookings,
          bookingDeleted: req.query.booking_deleted === "1",
          bookingCreated: req.query.booking_created === "1",
          authenticatedUser: req.authenticatedUser,
          role: "admin",
        });
      })
      .catch((error) => {
        console.error(error);
        res.status(500).render("status.ejs", {
          status: "Database Error",
          message: "Bookings could not be loaded.",
        });
      });
  }

  /** @type {express.RequestHandler} */
  static handleBookingManagement(req, res) {
    const booking = new BookingsModel(
      req.params.id ? Number(req.params.id) : null,
      req.body.sessionId ?? req.body.session_id,
      Number(req.body.userId ?? req.body.user_id ?? 0),
      req.body.action === "create" ? new Date() : undefined,
    );

    if (req.body.action === "create") {
      return BookingsModel.create(booking)
        .then(() => res.redirect(bookingPageUrl(req, { bookingCreated: true })))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The booking could not be created.",
          });
        });
    } else if (req.body.action === "update") {
      return BookingsModel.update(booking)
        .then((result) =>
          result.affectedRows > 0
            ? res.redirect(bookingPageUrl(req))
            : res.status(404).render("status.ejs", {
                status: "Booking Update Failed",
                message: "The booking could not be found.",
              }),
        )
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The booking could not be updated.",
          });
        });
    } else if (req.body.action === "delete") {
      const deleteBooking =
        req.authenticatedUser?.role === "trainer"
          ? BookingsModel.getById(booking.id)
              .then((existingBooking) =>
                SessionsModel.getById(existingBooking.session_id).then(
                  (session) => ({ existingBooking, session }),
                ),
              )
              .then(({ existingBooking, session }) => {
                const ownsSession =
                  Number(session.trainer_id) ===
                  Number(req.authenticatedUser.id);
                const ownsBooking =
                  Number(existingBooking.user_id) ===
                  Number(req.authenticatedUser.id);
                if (!ownsSession && !ownsBooking) {
                  return res.status(403).render("status.ejs", {
                    status: "Booking Deletion Forbidden",
                    message:
                      "You can only delete bookings for your own sessions or your own bookings",
                  });
                }
                return BookingsModel.delete(booking.id);
              })
          : BookingsModel.delete(booking.id);
      return deleteBooking
        .then((result) =>
          result == null
            ? undefined
            : result.affectedRows > 0
              ? res.redirect(bookingPageUrl(req, { bookingDeleted: true }))
              : res.status(404).render("status.ejs", {
                  status: "Booking Deletion Failed",
                  message: "The booking could not be found.",
                }),
        )
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The booking could not be deleted.",
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
      res.json(await BookingsModel.getAll());
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async getById(req, res, next) {
    try {
      res.json(await BookingsModel.getById(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async create(req, res, next) {
    try {
      const result = await BookingsModel.create(req.body);
      res.status(result.duplicate ? 409 : 201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async update(req, res, next) {
    try {
      res.json(
        await BookingsModel.update({ ...req.body, id: Number(req.params.id) }),
      );
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async delete(req, res, next) {
    try {
      res.json(await BookingsModel.delete(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  }
}
