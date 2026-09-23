import express from "express";
import { BookingsModel } from "../models/BookingsModel.mjs";

/** HTTP handlers for bookings. */
export class BookingsController {
  /** @type {import("express").Router} */
  static routes = express.Router();

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