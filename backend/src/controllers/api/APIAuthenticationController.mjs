import express from "express";
import { UsersModel } from "../../models/UsersModel.mjs";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { APIError } from "./apiHelpers.mjs";

export class APIAuthenticationController {
  static middleware = express.Router();
  static routes = express.Router();

  static {
    // Setup API Authentication Provider
    this.middleware.use(this.#APIAuthenticationProvider);
    this.routes.post("/authenticate", this.handleAuthenticate);
    this.routes.delete("/authenticate", this.handleAuthenticate);
  }

  /**
   * This middleware checks the for the API key header and
   * loads the respective user into req.authenticatedUser if found.
   *
   * @private
   * @type {express.RequestHandler}
   */
  static async #APIAuthenticationProvider(req, _res, next) {
    req.authenticatedUser = undefined;
    const authenticationKey = req.headers["x-auth-key"];
    if (authenticationKey !== undefined) {
      if (
        typeof authenticationKey !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          authenticationKey,
        )
      ) {
        throw new APIError(401, "Invalid authentication key.");
      }
      try {
        req.authenticatedUser =
          await UsersModel.getByAuthenticationKey(authenticationKey);
      } catch (error) {
        if (error === "not found") {
          throw new APIError(401, "Invalid authentication key.");
        }
        throw error;
      }
    }
    next();
  }

  /**
   * @type {express.RequestHandler}
   * @openapi
   * /api/v1/authenticate:
   *      post:
   *          summary: "Authenticate with username and password"
   *          description: "Use your gym account email as username. Returns a new API key, replacing any previous key. Paste the key into Authorize to use protected endpoints."
   *          operationId: login
   *          tags: [Authentication]
   *          requestBody:
   *              required: true
   *              content:
   *                  application/json:
   *                      schema:
   *                          $ref: "#/components/schemas/UserCredentials"
   *          responses:
   *              '200':
   *                  $ref: "#/components/responses/LoginSuccessful"
   *              '400':
   *                  $ref: "#/components/responses/Error"
   *              '401':
   *                  $ref: "#/components/responses/Error"
   *              '500':
   *                  $ref: "#/components/responses/Error"
   *      delete:
   *          summary: "Deauthenticate"
   *          description: "Revoke the current API key."
   *          operationId: logout
   *          tags: [Authentication]
   *          security:
   *              - ApiKey: []
   *          responses:
   *              '200':
   *                  $ref: "#/components/responses/Updated"
   *              '400':
   *                  $ref: "#/components/responses/Error"
   *              '401':
   *                  $ref: "#/components/responses/Error"
   *              '500':
   *                  $ref: "#/components/responses/Error"
   *              default:
   *                  $ref: "#/components/responses/Error"
   */
  static async handleAuthenticate(req, res) {
    if (req.method === "POST") {
      try {
        const user = await UsersModel.getByUsername(req.body.username);

        if (await bcrypt.compare(req.body.password, user.password)) {
          // Generate a cryptographically secure and random UUID for use as the authentication key
          const authenticationKey = randomUUID();

          // Store the authenticated user's authentication key into the database
          user.authentication_key = authenticationKey;
          await UsersModel.update(user);

          res.status(200).json({
            key: authenticationKey,
          });
        } else {
          res.status(400).json({
            message: "Invalid credentials",
          });
        }
      } catch (error) {
        switch (error) {
          case "not found":
            res.status(400).json({
              message: "Invalid credentials",
            });
            break;
          default:
            console.error(error);
            res.status(500).json({
              message: "Failed to authenticate user",
            });
            break;
        }
      }
    } else if (req.method === "DELETE") {
      if (req.authenticatedUser) {
        // Clear authentication key and send JSON response
        const user = req.authenticatedUser;
        user.authentication_key = null;
        await UsersModel.update(user);
        res.status(200).json({
          message: "Deauthentication successful",
        });
      } else {
        res.status(401).json({
          message: "Not authenticated",
          errors: ["Please login to access the requested resource."],
        });
      }
    }
  }

  /**
   *
   * @param {Array<"admin" | "trainer" | "member"> | "any"} allowedRoles
   * @returns {express.RequestHandler}
   */
  static restrict(allowedRoles) {
    return function (req, res, next) {
      if (req.authenticatedUser) {
        if (
          allowedRoles === "any" ||
          allowedRoles.includes(req.authenticatedUser.role)
        ) {
          next();
        } else {
          res.status(403).json({
            message: "Access forbidden",
            errors: ["Role does not have access to the requested resource."],
          });
        }
      } else {
        res.status(401).json({
          message: "Not authenticated",
          errors: ["Please authenticate to access the requested resource."],
        });
      }
    };
  }
}
