import express from "express";
import { APIAuthenticationController } from "./APIAuthenticationController.mjs";
import { publicUser } from "./apiHelpers.mjs";

export class APIUserController {
  static routes = express.Router();

  static {
    this.routes.get(
      "/self",
      APIAuthenticationController.restrict("any"),
      this.getAuthenticatedUser,
    );
  }

  /**
   * Handle getting a user by their current authentication key header
   *
   * @type {express.RequestHandler}
   * @openapi
   * /api/v1/user/self:
   *      get:
   *          summary: "Get your authenticated user profile"
   *          tags: [Users]
   *          security:
   *              - ApiKey: []
   *          responses:
   *              '200':
   *                  description: 'Current profile, excluding password and authentication key'
   *                  content:
   *                      application/json:
   *                          schema:
   *                              $ref: "#/components/schemas/User"
   *              '400':
   *                  $ref: "#/components/responses/BadRequest"
   *              '401':
   *                  $ref: "#/components/responses/Unauthorized"
   *              '403':
   *                  $ref: "#/components/responses/Forbidden"
   *              '500':
   *                  $ref: "#/components/responses/InternalServerError"
   */
  static async getAuthenticatedUser(req, res) {
    res.status(200).json(publicUser(req.authenticatedUser));
  }
}
