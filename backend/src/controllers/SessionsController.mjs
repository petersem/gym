import express from "express";
import { SessionsModel } from "../models/SessionsModel.mjs";

/** HTTP handlers for sessions. */
export class SessionsController {
  /** @type {import("express").Router} */
  static routes = express.Router();

  static {
    this.routes.get("/", this.viewSessionManagement);
    this.routes.get("/:sid", this.viewSessionManagement);
    this.routes.post("/", this.handleSessionManagement);
    this.routes.post("/:sid", this.handleSessionManagement);
  }

  /** @type {import("express").RequestHandler} */
  static async viewSessionManagement(req, res) {
    try {
      const sessions = await SessionsModel.getAll();
      const selectedSession = sessions.find((session) => session.sid == req.params.sid)
        ?? new SessionsModel("", "", "", "");
      res.render("session_management.ejs", { sessions, selectedSession, role: "admin" });
    } catch (error) {
      res.status(500).render("status.ejs", { status: "Database Error", message: "Sessions could not be loaded." });
    }
  }

  /** @type {import("express").RequestHandler} */
  static async handleSessionManagement(req, res) {
    const session = new SessionsModel(
      req.params.sid ?? req.body.sid,
      req.body.data,
      req.body.lastAccess ?? req.body.last_access,
      req.body.expires,
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
        await SessionsModel.delete(session.sid);
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
    try { res.json(await SessionsModel.getById(req.params.sid)); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async create(req, res, next) {
    try { res.status(201).json(await SessionsModel.create(req.body)); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async update(req, res, next) {
    try { res.json(await SessionsModel.update({ ...req.body, sid: req.params.sid })); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async delete(req, res, next) {
    try { res.json(await SessionsModel.delete(req.params.sid)); }
    catch (error) { next(error); }
  }
}