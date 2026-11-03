import express from "express";
import bcrypt from "bcryptjs";
import { UsersModel } from "../../models/UsersModel.mjs";
import { DatabaseModel } from "../../models/DatabaseModel.mjs";
import { APIError, publicUser, validateUserDetails } from "./apiHelpers.mjs";
import {
  buildResourcePaths,
  createResourceRouter,
  errorResponses,
  ref,
  response,
} from "./apiResourceFactory.mjs";

/**
 * Configuration for the `/users` resource: members and trainers can read and
 * update only their own record.
 */
const usersResource = {
  path: "users",
  removedMethods: ["post", "delete"],
  list: false,
  schema: "User",
  tag: "Users",
  model: UsersModel,
  roles: [],
  getRoles: ["trainer", "member"],
  putRoles: ["trainer", "member"],
  patchRoles: ["trainer", "member"],
  conflicts: { update: "UserConflict", patch: "UserConflict" },
  description:
    "Members and trainers can read and update only their own record, without changing their role. Users cannot be listed, created or deleted through this resource; use GET /trainers to list trainers. Passwords and authentication keys are never returned.",
  serialize: publicUser,

  /**
   * Allow users to access only their own record.
   *
   * @param {{id: number|string}} user Authenticated user.
   * @param {object} record User record.
   * @throws {APIError} If the record belongs to another user.
   */
  authorize(user, record) {
    if (Number(record.id) !== Number(user?.id)) {
      throw new APIError(403, "You can only manage your own records.");
    }
  },

  /**
   * Validate a user update, protect the role, and hash changed passwords.
   *
   * @param {express.Request} req Request containing the input body.
   * @param {object} existing Existing user record.
   * @returns {Promise<object>} User record ready to be written.
   * @throws {APIError} If validation fails or the role is changed.
   */
  async prepare(req, existing) {
    const record = { ...existing, ...req.body, id: existing?.id ?? null };
    if (existing && record.role !== existing.role) {
      throw new APIError(403, "You cannot change your role.");
    }
    if (record.dob instanceof Date) {
      record.dob = DatabaseModel.toMySqlDate(record.dob);
    }
    validateUserDetails({ ...record, password: req.body.password });
    if (existing && req.body.password === "") {
      record.password = existing.password;
    } else if (req.body.password !== undefined) {
      if (
        existing &&
        (await bcrypt.compare(req.body.password, existing.password))
      ) {
        record.password = existing.password;
      } else {
        record.password = await bcrypt.hash(req.body.password, 10);
        record.authentication_key = null;
      }
    }
    record.dob ??= null;
    record.deleted = 0;
    return record;
  },
};

/**
 * Registers API routes for user records and the trainer list.
 */
export class APIUsersController {
  static routes = express.Router();

  /**
   * OpenAPI path definitions for the user endpoints.
   *
   * @type {Record<string, object>}
   */
  static paths = {
    ...buildResourcePaths(usersResource),
    "/api/v1/trainers": {
      get: {
        tags: ["Users"],
        operationId: "listTrainers",
        summary: "List trainers",
        description:
          "Guests, members and trainers can list trainers, which returns only ID, name and role. Administrators have no access.",
        security: [],
        responses: {
          200: response(
            { type: "array", items: ref("UserSummary") },
            "Trainers, ordered by ID.",
          ),
          ...errorResponses(400, 401, 403, 500, 503),
        },
      },
    },
  };

  static {
    this.routes.get("/trainers", this.listTrainers);
    this.routes.use("/users", createResourceRouter(usersResource));
  }

  /**
   * List trainers, exposing only their ID, name and role.
   *
   * @type {express.RequestHandler}
   */
  static async listTrainers(req, res) {
    res.json(
      (await UsersModel.getAll())
        .filter((user) => user.role === "trainer")
        .map(({ id, first_name, last_name, role }) => ({
          id,
          first_name,
          last_name,
          role,
        })),
    );
  }
}
