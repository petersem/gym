import express from "express";
import {
  UsersModel,
  USER_ROLE_ADMIN,
  USER_ROLE_TRAINER,
  USER_ROLE_MEMBER,
} from "../models/UsersModel.mjs";
import bcrypt from "bcrypt";
import { AuthenticationController } from "./AuthenticationController.mjs";
import { body } from "express-validator";
import { management } from "../utilities/formValidation.mjs";

/** HTTP handlers for users. */
export class UsersController {
  /** @type {express.Router} */
  static routes = express.Router();

  /**
   * Validation for the user management form. Field rules run for create and
   * update only. A new password is not refilled after an error; an unchanged
   * stored hash is, via the `passwordUnchanged` flag.
   * @type {express.RequestHandler[]}
   */
  static formValidation = management(
    "/users",
    [
      "firstName",
      "lastName",
      "email",
      "phone",
      "dob",
      "role",
      "passwordUnchanged",
    ],
    [
      body("firstName")
        .isString()
        .withMessage("First name must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 45 })
        .withMessage("First name must contain 1-45 characters."),
      body("lastName")
        .isString()
        .withMessage("Last name must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 45 })
        .withMessage("Last name must contain 1-45 characters."),
      body("email")
        .isString()
        .withMessage("Email must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("Email must contain 1-100 characters.")
        .bail()
        .isEmail()
        .withMessage("Email must be valid."),
      body("password")
        .isString()
        .withMessage("Password is required.")
        .bail()
        .custom(async (value, { req }) => {
          req.body.passwordUnchanged = "0";
          // The edit form is prefilled with the stored hash; saving it unchanged keeps the password.
          if (req.body.action === "update" && /^\$2[aby]\$/.test(value)) {
            const existing = await UsersModel.getById(req.params.id).catch(
              () => null,
            );
            if (existing && existing.password === value) {
              // Lets the form refill the stored hash if other fields are invalid.
              req.body.passwordUnchanged = "1";
              return true;
            }
          }
          if (value.length < 8 || Buffer.byteLength(value, "utf8") > 36) {
            throw new Error();
          }
          return true;
        })
        .withMessage(
          "Password must be at least 8 characters and at most 36 characters.",
        ),
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
      body("dob")
        .customSanitizer((value) => (value === "" ? null : value))
        .optional({ values: "null" })
        .isString()
        .withMessage("Date of birth must be a date.")
        .bail()
        .matches(/^\d{4}-\d{2}-\d{2}$/)
        .withMessage("Date of birth must use YYYY-MM-DD.")
        .bail()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("Date of birth must be a real calendar date."),
      body("role")
        .isString()
        .withMessage("Select a valid user role.")
        .bail()
        .isIn([USER_ROLE_ADMIN, USER_ROLE_TRAINER, USER_ROLE_MEMBER])
        .withMessage("Select a valid user role."),
      body("deleted")
        .optional()
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Deleted must be a valid number.")
        .bail()
        .isInt({ min: 0, max: 1, allow_leading_zeroes: false })
        .withMessage("Deleted must be an integer between 0 and 1."),
      body("authenticationKey")
        .optional()
        .isString()
        .withMessage("Authentication key must be text.")
        .bail()
        .trim()
        .isLength({ max: 36 })
        .withMessage("Authentication key must contain 0-36 characters."),
    ],
    { authenticationKey: "authentication_key" },
  );

  static {
    this.routes.get(
      "/",
      AuthenticationController.restrict("admin"),
      this.viewUserManagement,
    );

    this.routes.get(
      "/:id",
      AuthenticationController.restrict("admin"),
      this.viewUserManagement,
    );

    this.routes.post(
      "/",
      AuthenticationController.restrict("admin"),
      this.formValidation,
      this.handleUserManagement,
    );

    this.routes.post(
      "/:id",
      AuthenticationController.restrict("admin"),
      this.formValidation,
      this.handleUserManagement,
    );
  }

  /**
   * Renders the user management page with a filtered, sorted and paginated user
   * list. Loads the user in the URL into the edit form, even when that user is
   * not on the current page.
   * @type {express.RequestHandler}
   */
  static viewUserManagement(req, res) {
    const selectedUserId = req.params.id;
    const query = req.query ?? {};
    const selectedSearchTerm = String(query.search_term ?? "").trim();
    const selectedRole = [
      USER_ROLE_ADMIN,
      USER_ROLE_TRAINER,
      USER_ROLE_MEMBER,
    ].includes(query.role)
      ? query.role
      : "";
    const selectedSortBy = Object.keys(UsersModel.SORTABLE_COLUMNS).includes(
      query.sort_by,
    )
      ? query.sort_by
      : "last_name";
    const selectedSortDir = query.sort_dir === "desc" ? "desc" : "asc";
    const pageSize = 7;
    const selectedPage = Math.max(1, Number(query.page) || 1);
    const usersPromise = UsersModel.list({
      searchTerm: selectedSearchTerm,
      role: selectedRole,
      sortBy: selectedSortBy,
      sortDir: selectedSortDir,
      page: selectedPage,
      pageSize,
    });

    usersPromise
      .then(async ({ users, total }) => {
        const selectedUser =
          users.find((e) => String(e.id) === String(selectedUserId)) ??
          (selectedUserId
            ? await UsersModel.getById(selectedUserId).catch(() => null)
            : null) ??
          new UsersModel(null, "", "", "", "", "", "", "", 0, 0);

        res.render("user_management.ejs", {
          users,
          selectedUser,
          selectedSearchTerm,
          selectedRole,
          selectedSortBy,
          selectedSortDir,
          selectedPage,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          authenticatedUser: req.authenticatedUser,
          role: "admin",
          userDeleted: query.user_deleted === "1",
          userCreated: query.user_created === "1",
        });
      })
      .catch((error) => {
        console.log(error);
        res.status(500).render("status.ejs", {
          status: "Database Error",
          message: "Users could not be loaded.",
        });
      });
  }

  /**
   * Creates, updates or deletes a user from the validated management form.
   * Hashes the password unless it is already a bcrypt hash or the action is delete.
   * @type {express.RequestHandler}
   */
  static handleUserManagement(req, res) {
    const selectedUserId = req.params.id;
    const formData = req.body;
    const action = formData.action;

    const user = new UsersModel(
      selectedUserId,
      formData["firstName"],
      formData["lastName"],
      formData["role"],
      formData["email"],
      formData["password"],
      formData["phone"],
      formData["dob"],
      formData["deleted"],
      formData["authenticationKey"] ?? formData["authentication_key"] ?? 0,
    );

    // hash the password if it is not hashed
    if (action !== "delete" && !/^\$2[aby]\$/.test(user.password)) {
      user.password = bcrypt.hashSync(user.password, 10);
    }

    if (action === "create") {
      UsersModel.create(user)
        .then(() => {
          res.redirect("/users");
        })
        .catch((error) => {
          res.render("status.ejs", {
            status: "Database Error",
            message: "The user could not be created.",
          });
          console.error(error);
        });
    } else if (action === "update") {
      UsersModel.update(user)
        .then((result) => {
          if (result.affectedRows > 0) {
            res.redirect("/users");
          } else {
            res.render("status.ejs", {
              status: "User Update Failed",
              message: "The user could not be found.",
            });
          }
        })
        .catch((error) => {
          res.render("status.ejs", {
            status: "Database Error",
            message: "The user could not be updated.",
          });
          console.error(error);
        });
    } else if (action === "delete") {
      UsersModel.delete(user.id)
        .then((result) => {
          if (result.affectedRows > 0) {
            res.redirect("/users");
          } else {
            res.render("status.ejs", {
              status: "User Deletion Failed",
              message: "The user could not be found.",
            });
          }
        })
        .catch((error) => {
          res.render("status.ejs", {
            status: "Database Error",
            message: "The user could not be deleted.",
          });
          console.error(error);
        });
    } else {
      res.render("status.ejs", {
        status: "Invalid Action",
        message: "The form doesn't support this action.",
      });
    }
  }
}
