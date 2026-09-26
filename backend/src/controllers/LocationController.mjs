import express from "express";
import { LocationModel } from "../models/LocationModel.mjs";

export class LocationController {
  static routes = express.Router();

  static {
    //TODO: Setup routes
    this.routes.get("/", this.viewLocationList); // /locations/
    this.routes.get("/sales", this.viewLocationSales);
    this.routes.get("/:id", this.viewLocationDetails);
  }

  /**
   * Render the locations page, optionally filtered by a search term.
   * @type {express.RequestHandler}
   * Adding extra documentation for the parameters, if any
   */
  static viewLocationList(req, res) {
    if (req.query.search_term) {
      LocationModel.getBySearch(req.query.search_term)
        .then((locations) => {
          res.render("location_list.ejs", {
            locations,
            authenticatedUser: req.authenticatedUser,
          });
        })
        .catch((error) => console.error(error));
    } else {
      LocationModel.getAll()
        .then((locations) => {
          res.render("location_list.ejs", {
            locations,
            authenticatedUser: req.authenticatedUser,
          });
        })
        .catch((error) => console.error(error));
    }
    console.log("Authenticated user: " + JSON.stringify(req.authenticatedUser));
  }

  /**
   * @type {express.RequestHandler}
   */
  static viewLocationSales(req, res) {
    res.status(501).render("status.ejs", {
      status: "Sales Unavailable",
      message: "Location sales are not available yet.",
    });
  }

  static viewLocationDetails(req, res) {
    LocationModel.getById(req.params.id)
      .then((location) => {
        res.render("location_details.ejs", { location });
      })
      .catch((error) => {
        console.error(error);
        res.status(404).render("status.ejs", {
          status: "Location not found",
          message: "Maybe your location ID is invalid?",
        });
      });
    //TODO: Handle errors
  }
}
