import express from "express";
import { LocationModel } from "../../models/LocationModel.mjs";
import {
  buildResourcePaths,
  createResourceRouter,
} from "./apiResourceFactory.mjs";

/**
 * Configuration for the read-only, publicly readable `/locations` resource.
 */
const locationsResource = {
  path: "locations",
  removedMethods: ["post", "put", "delete"],
  schema: "Location",
  tag: "Locations",
  model: LocationModel,
  roles: [],
  publicRead: true,
  description:
    "Guests, members and trainers can list and read locations. Locations cannot be created, updated or deleted through the API.",
};

/**
 * Registers API routes for gym locations.
 */
export class APILocationsController {
  static routes = express.Router();

  /**
   * OpenAPI path definitions for the location endpoints.
   *
   * @type {Record<string, object>}
   */
  static paths = buildResourcePaths(locationsResource);

  static {
    this.routes.use("/locations", createResourceRouter(locationsResource));
  }
}
