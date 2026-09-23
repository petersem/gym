import express from "express";
import { ActivitiesModel } from "../models/ActivitiesModel.mjs";

/** HTTP handlers for activities.
 * @class
 */
export class ActivitiesController {
  /** @type {import("express").Router} */
  static routes = express.Router();

  /** @type {import("express").RequestHandler} */
  static async list(req, res, next) {
    try {
      const activities = req.query.search_term
        ? await ActivitiesModel.getBySearch(req.query.search_term)
        : await ActivitiesModel.getAll();
      res.json(activities);
    } catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async getById(req, res, next) {
    try { res.json(await ActivitiesModel.getById(Number(req.params.id))); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async create(req, res, next) {
    try { res.status(201).json(await ActivitiesModel.create(req.body)); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async update(req, res, next) {
    try { res.json(await ActivitiesModel.update({ ...req.body, id: Number(req.params.id) })); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async delete(req, res, next) {
    try { res.json(await ActivitiesModel.delete(Number(req.params.id))); }
    catch (error) { next(error); }
  }
}