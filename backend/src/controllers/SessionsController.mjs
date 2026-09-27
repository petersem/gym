import express from "express";
import { SessionsModel } from "../models/SessionsModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { ActivitiesModel } from "../models/ActivitiesModel.mjs";
import { LocationModel } from "../models/LocationModel.mjs";

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

const isPositiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

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
  static viewSessionManagement(req, res) {
    return Promise.all([
      SessionsModel.getAll(),
      UsersModel.getAll(),
      ActivitiesModel.getAll(),
      LocationModel.getAll(),
    ])
      .then(([sessions, users, activities, locations]) => {
      const selectedLocationId = Number(req.query.location_id) || null;
      const selectedTrainerId = Number(req.query.trainer_id) || null;
      const filteredSessions = sessions.filter((session) => (
        (!selectedLocationId || Number(session.location_id) === selectedLocationId)
        && (!selectedTrainerId || Number(session.trainer_id) === selectedTrainerId)
      ));
      const selectedSession = sessions.find((session) => session.id == req.params.id)
        ?? new SessionsModel(null, 0, 0, 0, "", "", "");
      res.render("session_management.ejs", {
        sessions: filteredSessions,
        users,
        activities,
        locations,
        selectedSession,
        selectedLocationId,
        selectedTrainerId,
        authenticatedUser: req.authenticatedUser,
        role: "admin",
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
      return SessionsModel.delete(session.id)
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