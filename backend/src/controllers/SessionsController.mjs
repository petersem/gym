import express from "express";
import { SessionsModel } from "../models/SessionsModel.mjs";

/** HTTP handlers for sessions. */
export class SessionsController {
  /** @type {import("express").Router} */
  static routes = express.Router();

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