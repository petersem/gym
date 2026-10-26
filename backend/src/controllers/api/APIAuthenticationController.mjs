import express from "express";
import { UsersModel } from "../../models/UsersModel.mjs";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { APIError, publicUser, validateUserDetails } from "./apiHelpers.mjs";

export class APIAuthenticationController {
  static middleware = express.Router();
  static routes = express.Router();

  static {
    // Setup API Authentication Provider
    this.middleware.use(this.#APIAuthenticationProvider);
    this.routes.post("/authenticate", this.handleAuthenticate);
    this.routes.delete("/authenticate", this.handleAuthenticate);
    this.routes.post("/register", this.handleRegister);
  }

  /**
   * This middleware checks for the API key header and
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
      if (!["member", "trainer"].includes(req.authenticatedUser.role)) {
        throw new APIError(403, "This role has no API access.");
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
   *          description: "Members and trainers only; administrators have no API access. Use your gym account email as username. Returns a new API key, replacing any previous key. Paste the key into Authorize to use protected endpoints."
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
   *                  $ref: "#/components/responses/LoginBadRequest"
   *              '401':
   *                  $ref: "#/components/responses/Unauthorized"
   *              '403':
   *                  $ref: "#/components/responses/Forbidden"
   *              '413':
   *                  $ref: "#/components/responses/PayloadTooLarge"
   *              '415':
   *                  $ref: "#/components/responses/UnsupportedMediaType"
   *              '500':
   *                  $ref: "#/components/responses/AuthenticationFailed"
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
   *                  $ref: "#/components/responses/BadRequest"
   *              '401':
   *                  $ref: "#/components/responses/Unauthorized"
   *              '403':
   *                  $ref: "#/components/responses/Forbidden"
   *              '500':
   *                  $ref: "#/components/responses/InternalServerError"
   */
  static async handleAuthenticate(req, res) {
    if (req.method === "POST") {
      try {
        const user = await UsersModel.getByUsername(req.body.username);

        if (await bcrypt.compare(req.body.password, user.password)) {
          if (!["member", "trainer"].includes(user.role)) {
            return res.status(403).json({
              message: "This role has no API access.",
            });
          }
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
   * Register a new member account for a guest.
   *
   * @type {express.RequestHandler}
   * @openapi
   * /api/v1/register:
   *      post:
   *          summary: "Register a new member account"
   *          description: "Guests only; requests with an x-auth-key are rejected. Creates an account with the member role. Log in with POST /authenticate afterwards to get an API key."
   *          operationId: register
   *          tags: [Authentication]
   *          requestBody:
   *              required: true
   *              content:
   *                  application/json:
   *                      schema:
   *                          $ref: "#/components/schemas/UserRegistration"
   *          responses:
   *              '201':
   *                  description: 'Member account created, excluding password and authentication key'
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
   *              '409':
   *                  $ref: "#/components/responses/Conflict"
   *              '413':
   *                  $ref: "#/components/responses/PayloadTooLarge"
   *              '415':
   *                  $ref: "#/components/responses/UnsupportedMediaType"
   *              '500':
   *                  $ref: "#/components/responses/InternalServerError"
   */
  static async handleRegister(req, res) {
    if (req.authenticatedUser) {
      throw new APIError(403, "Log out before registering a new account.");
    }
    const { first_name, last_name, email, password, phone } = req.body;
    const dob = req.body.dob ?? null;
    validateUserDetails({ phone, dob, password });
    const existing = await UsersModel.getByUsername(email).catch((error) => {
      if (error === "not found") return null;
      throw error;
    });
    if (existing) {
      throw new APIError(409, "An account with this email already exists.");
    }
    const user = new UsersModel(
      null,
      first_name.trim(),
      last_name.trim(),
      "member",
      email,
      await bcrypt.hash(password, 10),
      phone,
      dob,
      0,
      null,
    );
    const result = await UsersModel.create(user);
    user.id = result.insertId;
    res.status(201).json(publicUser(user));
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
