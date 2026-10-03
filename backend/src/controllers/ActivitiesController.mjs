import express from "express";
import { ActivitiesModel } from "../models/ActivitiesModel.mjs";
import { AuthenticationController } from "./AuthenticationController.mjs";
import { body } from "express-validator";
import { management } from "../utilities/formValidation.mjs";

/** HTTP handlers for activities.
 * @class
 */
export class ActivitiesController {
  /** @type {express.Router} */
  static routes = express.Router();

  /**
   * Validation for the activity management form. Field rules run for create
   * and update only; limits match the activities table columns.
   * @type {express.RequestHandler[]}
   */
  static formValidation = management(
    "/activities",
    ["name", "description"],
    [
      body("name")
        .isString()
        .withMessage("Name must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 45 })
        .withMessage("Name must contain 1-45 characters."),
      body("description")
        .isString()
        .withMessage("Must have a description.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 150 })
        .withMessage("Description must contain 1-150 characters."),
      body("deleted")
        .optional()
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Deleted must be a valid number.")
        .bail()
        .isInt({ min: 0, max: 1, allow_leading_zeroes: false })
        .withMessage("Deleted must be an integer between 0 and 1."),
      body("updatedBy")
        .optional()
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Updated by must be a valid number.")
        .bail()
        .isInt({ min: 0, max: 2147483647, allow_leading_zeroes: false })
        .withMessage("Updated by must be an integer between 0 and 2147483647."),
    ],
    { updatedBy: "updated_by" },
  );

  static {
    this.routes.get(
      "/",
      AuthenticationController.restrict("admin"),
      this.viewActivityManagement,
    );
    this.routes.get(
      "/:id",
      AuthenticationController.restrict("admin"),
      this.viewActivityManagement,
    );
    this.routes.post(
      "/",
      AuthenticationController.restrict("admin"),
      this.formValidation,
      this.handleActivityManagement,
    );
    this.routes.post(
      "/:id",
      AuthenticationController.restrict("admin"),
      this.formValidation,
      this.handleActivityManagement,
    );
  }

  /**
   * Renders the activity management page with a filtered, sorted and paginated
   * activity list. Loads the activity in the URL into the edit form, even when it
   * is not on the current page.
   * @type {express.RequestHandler}
   */
  static async viewActivityManagement(req, res) {
    const selectedSearchTerm = String(req.query.search_term ?? "").trim();
    const selectedSortBy = Object.keys(
      ActivitiesModel.SORTABLE_COLUMNS,
    ).includes(req.query.sort_by)
      ? req.query.sort_by
      : "name";
    const selectedSortDir = req.query.sort_dir === "desc" ? "desc" : "asc";
    const pageSize = 7;
    const selectedPage = Math.max(1, Number(req.query.page) || 1);
    try {
      const { activities, total } = await ActivitiesModel.list({
        searchTerm: selectedSearchTerm,
        sortBy: selectedSortBy,
        sortDir: selectedSortDir,
        page: selectedPage,
        pageSize,
      });
      const selectedActivity =
        activities.find((activity) => String(activity.id) === req.params.id) ??
        (req.params.id
          ? await ActivitiesModel.getById(req.params.id).catch(() => null)
          : null) ??
        new ActivitiesModel(null, "", "", 0, 0);
      res.render("activity_management.ejs", {
        activities,
        selectedActivity,
        selectedSearchTerm,
        selectedSortBy,
        selectedSortDir,
        selectedPage,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        authenticatedUser: req.authenticatedUser ?? {},
        role: "admin",
      });
    } catch {
      res.status(500).render("status.ejs", {
        status: "Database Error",
        message: "Activities could not be loaded.",
      });
    }
  }

  /**
   * Creates, updates or deletes an activity from the validated management form.
   * @type {express.RequestHandler}
   */
  static async handleActivityManagement(req, res) {
    const activity = new ActivitiesModel(
      req.params.id ? Number(req.params.id) : null,
      req.body.name,
      req.body.description,
      Number(req.body.deleted ?? 0),
      Number(req.body.updatedBy ?? 0),
    );

    try {
      if (req.body.action === "create") {
        await ActivitiesModel.create(activity);
        return res.redirect("/activities");
      }
      if (req.body.action === "update") {
        const result = await ActivitiesModel.update(activity);
        return result.affectedRows > 0
          ? res.redirect("/activities")
          : res.status(404).render("status.ejs", {
              status: "Activity Update Failed",
              message: "The activity could not be found.",
            });
      }
      if (req.body.action === "delete") {
        const result = await ActivitiesModel.delete(activity.id);
        return result.affectedRows > 0
          ? res.redirect("/activities")
          : res.status(404).render("status.ejs", {
              status: "Activity Deletion Failed",
              message: "The activity could not be found.",
            });
      }
      return res.status(400).render("status.ejs", {
        status: "Invalid Action",
        message: "The form doesn't support this action.",
      });
    } catch {
      return res.status(500).render("status.ejs", {
        status: "Database Error",
        message: "The activity could not be saved.",
      });
    }
  }

  /** @type {express.RequestHandler} */
  static async list(req, res, next) {
    try {
      const activities = req.query.search_term
        ? await ActivitiesModel.getBySearch(req.query.search_term)
        : await ActivitiesModel.getAll();
      res.json(activities);
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async getById(req, res, next) {
    try {
      res.json(await ActivitiesModel.getById(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async create(req, res, next) {
    try {
      res.status(201).json(await ActivitiesModel.create(req.body));
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async update(req, res, next) {
    try {
      res.json(
        await ActivitiesModel.update({
          ...req.body,
          id: Number(req.params.id),
        }),
      );
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async delete(req, res, next) {
    try {
      res.json(await ActivitiesModel.delete(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  }
}
