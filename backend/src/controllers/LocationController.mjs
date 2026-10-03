import express from "express";
import { LocationModel } from "../models/LocationModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { AuthenticationController } from "./AuthenticationController.mjs";
import { body } from "express-validator";
import { management } from "../utilities/formValidation.mjs";

/** HTTP handlers for locations. */
export class LocationController {
  /** @type {express.Router} */
  static routes = express.Router();

  /**
   * Validation for the location management form. Field rules run for create
   * and update only; limits match the locations table columns.
   * @type {express.RequestHandler[]}
   */
  static formValidation = management(
    "/locations",
    ["name", "phone", "email", "street", "suburb", "postcode", "manager"],
    [
      body("name")
        .isString()
        .withMessage("Name must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("Name must contain 1-100 characters."),
      body("phone")
        .isString()
        .withMessage("Phone must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 20 })
        .withMessage("Phone must contain 1-20 characters.")
        .bail()
        .matches(/^\+?[\d ().-]+$/)
        .withMessage("Phone must contain digits and standard phone separators.")
        .bail()
        .custom((value) => /\d/.test(value))
        .withMessage("Phone must contain digits."),
      body("email")
        .isString()
        .withMessage("Email must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 45 })
        .withMessage("Email must contain 1-45 characters.")
        .bail()
        .isEmail()
        .withMessage("Email must be valid."),
      body("street")
        .isString()
        .withMessage("Street must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("Street must contain 1-100 characters."),
      body("suburb")
        .isString()
        .withMessage("Suburb must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("Suburb must contain 1-100 characters."),
      body("postcode")
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Postcode must be a valid number.")
        .bail()
        .isInt({ min: 0, max: 9999, allow_leading_zeroes: false })
        .withMessage("Postcode must be an integer between 0 and 9999."),
      body("manager")
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Manager must be a valid number.")
        .bail()
        .isInt({ min: 1, max: 2147483647, allow_leading_zeroes: false })
        .withMessage("Manager must be an integer between 1 and 2147483647."),
      body("deleted")
        .optional()
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Deleted must be a valid number.")
        .bail()
        .isInt({ min: 0, max: 1, allow_leading_zeroes: false })
        .withMessage("Deleted must be an integer between 0 and 1."),
    ],
  );

  static {
    this.routes.get(
      "/",
      AuthenticationController.restrict(["admin"]),
      this.viewLocationManagement,
    );

    this.routes.get("/sales", this.viewLocationSales);

    this.routes.get(
      "/:id",
      AuthenticationController.restrict(["admin"]),
      this.viewLocationManagement,
    );

    this.routes.post(
      "/",
      AuthenticationController.restrict(["admin"]),
      this.formValidation,
      this.handleLocationManagement,
    );

    this.routes.post(
      "/:id",
      AuthenticationController.restrict(["admin"]),
      this.formValidation,
      this.handleLocationManagement,
    );
  }

  /**
   * Renders the location management page with a filtered, sorted and paginated
   * location list. Loads the location in the URL into the edit form, even when it
   * is not on the current page.
   * @type {express.RequestHandler}
   */
  static viewLocationManagement(req, res) {
    const selectedLocationId = req.params.id;
    const selectedSearchTerm = String(req.query.search_term ?? "").trim();
    const selectedSortBy = Object.keys(LocationModel.SORTABLE_COLUMNS).includes(
      req.query.sort_by,
    )
      ? req.query.sort_by
      : "name";
    const selectedSortDir = req.query.sort_dir === "desc" ? "desc" : "asc";
    const pageSize = 7;
    const selectedPage = Math.max(1, Number(req.query.page) || 1);
    const locationsPromise = LocationModel.list({
      searchTerm: selectedSearchTerm,
      sortBy: selectedSortBy,
      sortDir: selectedSortDir,
      page: selectedPage,
      pageSize,
    });

    Promise.all([locationsPromise, UsersModel.getAll()])
      .then(async ([{ locations, total }, users]) => {
        const selectedLocation =
          locations.find(
            (location) => String(location.id) === selectedLocationId,
          ) ??
          (selectedLocationId
            ? await LocationModel.getById(selectedLocationId).catch(() => null)
            : null) ??
          new LocationModel(null, "", "", "", "", "", 0, 0, 0, 0);

        res.render("location_management.ejs", {
          locations,
          users,
          selectedLocation,
          selectedSearchTerm,
          selectedSortBy,
          selectedSortDir,
          selectedPage,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          authenticatedUser: req.authenticatedUser ?? {},
          role: "admin",
        });
      })
      .catch((error) => {
        console.log(error);
        res.status(500).render("status.ejs", {
          status: "Database Error",
          message: "Locations could not be loaded.",
        });
      });
  }

  /** @type {express.RequestHandler} */
  static viewLocationList(req, res) {
    const selectedSearchTerm = String(req.query.search_term ?? "").trim();
    const selectedSortBy = Object.keys(LocationModel.SORTABLE_COLUMNS).includes(
      req.query.sort_by,
    )
      ? req.query.sort_by
      : "name";
    const selectedSortDir = req.query.sort_dir === "desc" ? "desc" : "asc";
    const loadLocations =
      req.query.sort_by || req.query.sort_dir
        ? LocationModel.list({
            searchTerm: selectedSearchTerm,
            sortBy: selectedSortBy,
            sortDir: selectedSortDir,
          }).then((result) => result.locations)
        : req.query.search_term
          ? LocationModel.getBySearch(req.query.search_term)
          : LocationModel.getAll();

    loadLocations
      .then((locations) => {
        res.render("location_list.ejs", {
          locations,
          searchTerm: selectedSearchTerm,
          selectedSortBy,
          selectedSortDir,
          authenticatedUser: req.authenticatedUser,
          role: req.authenticatedUser?.role ?? "",
        });
      })
      .catch((error) => {
        console.error(error);
        res.status(500).render("status.ejs", {
          status: "Database Error",
          message: "Locations could not be loaded.",
        });
      });
  }

  /** @type {express.RequestHandler} */
  static viewLocationSales(req, res) {
    res.status(501).render("status.ejs", {
      status: "Locations Unavailable",
      message: "Locations are not available yet.",
    });
  }

  /** @type {express.RequestHandler} */
  static viewLocationDetails(req, res) {
    LocationModel.getById(req.params.id)
      .then((location) => {
        res.render("location_details.ejs", {
          location,
          authenticatedUser: req.authenticatedUser,
          role: req.authenticatedUser?.role ?? "",
        });
      })
      .catch((error) => {
        console.error(error);
        res.status(404).render("status.ejs", {
          status: "Location not found",
          message: "Maybe your location ID is invalid?",
        });
      });
  }

  /**
   * Creates, updates or deletes a location from the validated management form.
   * @type {express.RequestHandler}
   */
  static handleLocationManagement(req, res) {
    const authenticatedUserId = Number(req.authenticatedUser?.id);
    if (!Number.isInteger(authenticatedUserId) || authenticatedUserId <= 0) {
      return res.status(401).render("status.ejs", {
        status: "Unauthenticated",
        message: "Please log in before managing locations.",
      });
    }

    const formData = req.body;
    const location = new LocationModel(
      req.params.id ? Number(req.params.id) : null,
      formData.name,
      formData.phone,
      formData.email,
      formData.street,
      formData.suburb,
      Number(formData.postcode ?? 0),
      Number(formData.manager ?? 0),
      Number(formData.deleted ?? 0),
      authenticatedUserId,
    );

    if (formData.action === "create") {
      LocationModel.create(location)
        .then(() => res.redirect(303, "/locations"))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The location could not be created.",
          });
        });
    } else if (formData.action === "update") {
      LocationModel.update(location)
        .then(() => {
          res.redirect(303, "/locations");
        })
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The location could not be updated.",
          });
        });
    } else if (formData.action === "delete") {
      LocationModel.delete(location.id)
        .then((result) => {
          if (result.affectedRows > 0) {
            res.redirect(303, "/locations");
          } else {
            res.status(404).render("status.ejs", {
              status: "Location Deletion Failed",
              message: "The location could not be found.",
            });
          }
        })
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The location could not be deleted.",
          });
        });
    } else {
      res.status(400).render("status.ejs", {
        status: "Invalid Action",
        message: "The form doesn't support this action.",
      });
    }
  }
}
