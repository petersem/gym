import express from "express";
import session from "express-session";
import { USER_ROLE_MEMBER, UsersModel } from "../models/UsersModel.mjs";
import bcrypt from "bcrypt";
import { body } from "express-validator";
import { rejectInvalidForm } from "../utilities/formValidation.mjs";

/**
 * AuthenticationController handles user authentication, registration, and session management.
 */
export class AuthenticationController {
  /**
   * Session and authenticated-user middleware.
   * @type {express.Router}
   */
  static middleware = express.Router();
  /**
   * Login, registration and logout routes.
   * @type {express.Router}
   */
  static routes = express.Router();

  /**
   * Validation for the login form. Only the email is refilled after an error, not the password.
   * @type {express.RequestHandler[]}
   */
  static loginValidation = [
    body("username")
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
      .notEmpty()
      .withMessage("Password is required."),
    rejectInvalidForm("/authenticate", ["username"]),
  ];

  /**
   * Validation for the registration form. Limits match the users table columns;
   * the password is limited to 72 UTF-8 bytes because bcrypt ignores the rest.
   * @type {express.RequestHandler[]}
   */
  static registerValidation = [
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
      .custom(
        (value) => value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72,
      )
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
    rejectInvalidForm("/authenticate/register", [
      "firstName",
      "lastName",
      "email",
      "phone",
      "dob",
    ]),
  ];

  static {
    this.middleware.use(
      session({
        secret: "9c55abf5-111d-4235-b8d8-07c3463999e7",
        resave: false,
        saveUninitialized: false,
        cookie: { secure: "auto" },
      }),
    );

    this.middleware.use(this.#sessionAuthenticationProvider);

    this.routes.get("/", this.viewLogin);
    this.routes.post("/", this.loginValidation, this.handleLogin);
    this.routes.get("/register", this.viewRegister);
    this.routes.post("/register", this.registerValidation, this.handleRegister);

    this.routes.delete("/", this.handleLogout);
    this.routes.get("/logout", this.handleLogout);
  }

  /**
   * Automatically stores the respective EmployeeModel into req.authenticatedUsed
   * if there is an active session containing an userId
   * @type {express.RequestHandler}
   */
  static async #sessionAuthenticationProvider(req, res, next) {
    if (req.session.userId && !req.authenticatedUser) {
      try {
        req.authenticatedUser = await UsersModel.getById(req.session.userId);
      } catch (error) {
        console.error("Failed to authenticate user session - " + error);
      }
    }
    next();
  }

  /**
   * @type {express.RequestHandler}
   */
  static viewLogin(req, res) {
    res.render("login.ejs");
  }

  /**
   * Render the member registration form.
   * @type {express.RequestHandler}
   */
  static viewRegister(req, res) {
    res.render("register.ejs");
  }

  /**
   * @type {express.RequestHandler}
   */
  static async handleLogin(req, res) {
    const username = req.body["username"];
    const password = req.body["password"];

    try {
      const user = await UsersModel.getByUsername(username);
      const isCorrectPassword = await bcrypt.compare(password, user.password);

      if (isCorrectPassword) {
        // Store the authenticated user's ID into the session
        req.session.userId = user.id;

        res.redirect("/");
      } else {
        res.status(400).render("status.ejs", {
          status: "Authentication Failed.",
          message: "Invalid credentials.",
        });
      }
    } catch (error) {
      if (error === "not found") {
        res.status(400).render("status.ejs", {
          status: "Authentication Failed.",
          message: "Invalid credentials.",
        });
      } else {
        console.error(error);
        res.status(500).render("status.ejs", {
          status: "Authentication Failed.",
          message: "Server error.",
        });
      }
    }
  }

  /**
   * Create a member account with a hashed password and redirect to login.
   * @type {express.RequestHandler}
   */
  static async handleRegister(req, res) {
    const { firstName, lastName, email, password, phone, dob } = req.body;

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      await UsersModel.create(
        new UsersModel(
          null,
          firstName,
          lastName,
          USER_ROLE_MEMBER,
          email,
          passwordHash,
          phone,
          dob || null,
          0,
          null,
        ),
      );
      res.redirect("/authenticate");
    } catch (error) {
      console.error(error);
      res.status(400).render("status.ejs", {
        status: "Registration Failed.",
        message: "The account could not be created.",
      });
    }
  }

  /**
   * @type {express.RequestHandler}
   */
  static handleLogout(req, res) {
    if (req.authenticatedUser) {
      if (req.session.userId) {
        req.session.destroy();
        res.status(200).render("status.ejs", {
          status: "Logged out successfully.",
          message: "You have been logged out.",
        });
      }
    } else {
      res.status(401).render("status.ejs", {
        status: "Unauthenticated.",
        message: "Please login to access the requested resource.",
      });
    }
  }

  /**
   * Restrict access to users with one of the specified roles.
   * @param {Array<"admin" | "trainer" | "member">} allowedRoles Roles allowed to access the resource.
   * @returns {express.RequestHandler}
   */
  static restrict(allowedRoles) {
    return function (req, res, next) {
      if (req.authenticatedUser) {
        if (allowedRoles.includes(req.authenticatedUser.role)) {
          next();
        } else {
          res.status(403).render("status.ejs", {
            status: "Access Forbidden.",
            message: "Role does not have access to the requested resource.",
          });
        }
      } else {
        res.status(401).render("status.ejs", {
          status: "Unauthenticated.",
          message: "Please login to access the requested resource.",
        });
      }
    };
  }
}
