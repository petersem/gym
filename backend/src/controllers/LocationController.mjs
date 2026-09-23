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
    const daysOfWeek = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const today = new Date();
    //Calculate the date of the start of the current week (Monday of this week)
    const mondayOfThisWeek = new Date();
    mondayOfThisWeek.setDate(today.getDate() - (today.getDay() - 1));

    //Calculate the date of the end of the current week (Sunday of this week)
    const sundayOfThisWeek = new Date(mondayOfThisWeek);
    sundayOfThisWeek.setDate(mondayOfThisWeek.getDate() + 6);

    // console.log(mondayOfThisWeek.toLocaleString());
    // console.log(sundayOfThisWeek.toLocaleString());
    //Create an object with the days of the week as fields, each with an array inside
    const salesByDay = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };

    //Create a currency formatting tool to convert numbers like 10 to $10.00
    const currencyFormatter = new Intl.NumberFormat("en-au", {
      style: "currency",
      currency: "AUD",
    });

    //Query the database for sales between the start and end date
    SaleProductModel.getByStartAndEndDate(
      mondayOfThisWeek,
      sundayOfThisWeek,
    ).then((productSalesOnthisWeek) => {
      for (const saleProduct of productSalesOnthisWeek) {
        //Get name of the day (e.g. Monday) based on the sale date
        const saleDayName = daysOfWeek[saleProduct.sale.date.getDay()];
        //Look up in the salesByDay object and find the matching day name,
        //and then we add the current sale to that days list of sales
        salesByDay[saleDayName].push(saleProduct);
      }
      //console.log(salesByDay);

      res.render("sales_list.ejs", {
        salesByDay,
        currencyFormatter,
      });
    });
    //Loop through each of the sales, and add each of them to their
    //respective day of the week.
  }

  /**
   * @type {express.RequestHandler}
   */
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
