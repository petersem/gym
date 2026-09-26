import express from "express";
import { SessionsModel } from "../models/SessionsModel.mjs";

/** HTTP handlers for sessions. */
export class SessionsController {
  /** @type {import("express").Router} */
  static routes = express.Router();

  static {
    this.routes.get("/", this.viewSessionManagement);
    this.routes.get("/:id", this.viewSessionManagement);
    this.routes.post("/", this.handleSessionManagement);
    this.routes.post("/:id", this.handleSessionManagement);
  }

  /** @type {import("express").RequestHandler} */
  static async viewSessionManagement(req, res) {
    try {
      const sessions = await SessionsModel.getAll();
      const selectedSession = sessions.find((session) => session.id == req.params.id)
        ?? new SessionsModel(null, 0, 0, 0, "", "");
      res.render("session_management.ejs", { sessions, selectedSession, role: "admin" });
    } catch (error) {
      res.status(500).render("status.ejs", { status: "Database Error", message: "Sessions could not be loaded." });
    }
  }

  /** @type {import("express").RequestHandler} */
  static async handleSessionManagement(req, res) {
    const session = new SessionsModel(
      req.params.id ? Number(req.params.id) : null,
      Number(req.body.activityId ?? req.body.activity_id ?? 0),
      Number(req.body.locationId ?? req.body.location_id ?? 0),
      Number(req.body.trainerId ?? req.body.trainer_id ?? 0),
      req.body.date,
      req.body.time,
    );

    try {
      if (req.body.action === "create") {
        await SessionsModel.create(session);
        return res.redirect("/sessions");
      }
      if (req.body.action === "update") {
        await SessionsModel.update(session);
        return res.redirect("/sessions");
      }
      if (req.body.action === "delete") {
        await SessionsModel.delete(session.id);
        return res.redirect("/sessions");
      }
      return res.status(400).render("status.ejs", { status: "Invalid Action", message: "The form doesn't support this action." });
    } catch (error) {
      return res.status(500).render("status.ejs", { status: "Database Error", message: "The session could not be saved." });
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