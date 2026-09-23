import express from "express";
import { BookingsModel } from "../models/BookingsModel.mjs";

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
  static async viewBookingManagement(req, res) {
    try {
      const bookings = await BookingsModel.getAll();
      const selectedBooking = bookings.find((booking) => booking.id == req.params.id)
        ?? new BookingsModel(null, "", 0, "");
      res.render("booking_management.ejs", { bookings, selectedBooking, role: "admin" });
    } catch (error) {
      res.status(500).render("status.ejs", { status: "Database Error", message: "Bookings could not be loaded." });
    }
  }

  /** @type {import("express").RequestHandler} */
  static async handleBookingManagement(req, res) {
    const booking = new BookingsModel(
      req.params.id ? Number(req.params.id) : null,
      req.body.sessionId ?? req.body.session_id,
      Number(req.body.userId ?? req.body.user_id ?? 0),
      req.body.created,
    );

    try {
      if (req.body.action === "create") {
        await BookingsModel.create(booking);
        return res.redirect("/bookings");
      }
      if (req.body.action === "update") {
        const result = await BookingsModel.update(booking);
        return result.affectedRows > 0
          ? res.redirect("/bookings")
          : res.status(404).render("status.ejs", { status: "Booking Update Failed", message: "The booking could not be found." });
      }
      if (req.body.action === "delete") {
        const result = await BookingsModel.delete(booking.id);
        return result.affectedRows > 0
          ? res.redirect("/bookings")
          : res.status(404).render("status.ejs", { status: "Booking Deletion Failed", message: "The booking could not be found." });
      }
      return res.status(400).render("status.ejs", { status: "Invalid Action", message: "The form doesn't support this action." });
    } catch (error) {
      return res.status(500).render("status.ejs", { status: "Database Error", message: "The booking could not be saved." });
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
    try { res.status(201).json(await BookingsModel.create(req.body)); }
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