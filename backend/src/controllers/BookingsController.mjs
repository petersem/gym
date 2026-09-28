import express from "express";
import { BookingsModel } from "../models/BookingsModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { SessionsModel } from "../models/SessionsModel.mjs";
import { LocationModel } from "../models/LocationModel.mjs";
import { ActivitiesModel } from "../models/ActivitiesModel.mjs";

const bookingPageUrl = (req, { bookingDeleted = false, bookingCreated = false } = {}) => {
  const query = new URLSearchParams();
  const bookingUserId = Number(req.query.booking_user_id);
  if (Number.isInteger(bookingUserId) && bookingUserId > 0) {
    query.set("booking_user_id", String(bookingUserId));
  }
  if (bookingDeleted) query.set("booking_deleted", "1");
  if (bookingCreated) query.set("booking_created", "1");
  const search = query.toString();
  return search ? `/bookings?${search}` : "/bookings";
};

/** HTTP handlers for bookings. */
export class BookingsController {
  /** @type {import("express").Router} */
  static routes = express.Router();

  static {
    this.routes.get("/", this.viewBookingManagement);
    this.routes.get("/:id", this.viewBookingManagement);
    this.routes.post("/", this.handleBookingManagement);
    this.routes.post("/:id", this.handleBookingManagement);
  }

  /** @type {import("express").RequestHandler} */
  static viewBookingManagement(req, res) {
    const canManageBookings = ["admin", "trainer"].includes(req.authenticatedUser?.role);
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
      const selectedBooking = bookings.find((booking) => booking.id == req.params.id)
        ?? new BookingsModel(null, req.query.session_id ?? "", 0, "");
      const availableLocationId = Number(req.query.available_location_id) || null;
      const bookingLocationId = Number(req.query.booking_location_id) || null;
      const bookingUserIdParam = req.query.booking_user_id;
      const bookingUserId = canManageBookings
        ? bookingUserIdParam === undefined
          ? req.authenticatedUser?.id ?? null
          : bookingUserIdParam === "all"
            ? null
            : Number(bookingUserIdParam) || null
        : req.authenticatedUser?.id ?? null;
      const availableSessions = availableLocationId
        ? sessions.filter((session) => Number(session.location_id) === availableLocationId)
        : sessions;
      const bookingSessions = bookingLocationId
        ? sessions.filter((session) => Number(session.location_id) === bookingLocationId)
        : sessions;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const byTime = (left, right) => String(left.time).localeCompare(String(right.time));
      const calendarDays = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() + index);
        const dateValue = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");
        const daySessions = availableSessions
          .filter((session) => String(session.date).slice(0, 10) === dateValue)
          .sort(byTime);
        return {
          dateValue,
          label: `${date.toLocaleDateString("en-AU", { weekday: "short" }).slice(0, 3)} ${date.getDate()} ${date.toLocaleDateString("en-AU", { month: "short" }).slice(0, 3)}`,
          bookings: bookings
            .filter((booking) => daySessions.some((session) => session.id === Number(booking.session_id)))
            .sort((left, right) => byTime(
              daySessions.find((session) => session.id === Number(left.session_id)),
              daySessions.find((session) => session.id === Number(right.session_id)),
            )),
          sessions: daySessions,
        };
      });
      const bookingCalendarDays = calendarDays.map((day) => ({
        ...day,
        sessions: bookingSessions
          .filter((session) => String(session.date).slice(0, 10) === day.dateValue)
          .sort(byTime),
      })).map((day) => ({
        ...day,
        bookings: bookings
          .filter((booking) => (
            day.sessions.some((session) => session.id === Number(booking.session_id))
            && (!bookingUserId || Number(booking.user_id) === Number(bookingUserId))
          ))
          .sort((left, right) => byTime(
            day.sessions.find((session) => session.id === Number(left.session_id)),
            day.sessions.find((session) => session.id === Number(right.session_id)),
          )),
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
        res.status(500).render("status.ejs", { status: "Database Error", message: "Bookings could not be loaded." });
      });
  }

  /** @type {import("express").RequestHandler} */
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
          res.status(500).render("status.ejs", { status: "Database Error", message: "The booking could not be created." });
        });
    } else if (req.body.action === "update") {
      return BookingsModel.update(booking)
        .then((result) => result.affectedRows > 0
          ? res.redirect(bookingPageUrl(req))
          : res.status(404).render("status.ejs", { status: "Booking Update Failed", message: "The booking could not be found." }))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", { status: "Database Error", message: "The booking could not be updated." });
        });
    } else if (req.body.action === "delete") {
      return BookingsModel.delete(booking.id)
        .then((result) => result.affectedRows > 0
          ? res.redirect(bookingPageUrl(req, { bookingDeleted: true }))
          : res.status(404).render("status.ejs", { status: "Booking Deletion Failed", message: "The booking could not be found." }))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", { status: "Database Error", message: "The booking could not be deleted." });
        });
    } else {
      res.status(400).render("status.ejs", { status: "Invalid Action", message: "The form doesn't support this action." });
    }
  }

  /** @type {import("express").RequestHandler} */
  static async list(req, res, next) {
    try { res.json(await BookingsModel.getAll()); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async getById(req, res, next) {
    try { res.json(await BookingsModel.getById(Number(req.params.id))); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async create(req, res, next) {
    try {
      const result = await BookingsModel.create(req.body);
      res.status(result.duplicate ? 409 : 201).json(result);
    }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async update(req, res, next) {
    try { res.json(await BookingsModel.update({ ...req.body, id: Number(req.params.id) })); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async delete(req, res, next) {
    try { res.json(await BookingsModel.delete(Number(req.params.id))); }
    catch (error) { next(error); }
  }
}