/**
 * Shared express-validator support for server-rendered forms.
 *
 * Controllers define their own field rules and messages. This module adds the
 * checks common to every management form (action and record ID) and handles
 * the redirect back to the form when validation fails.
 * @module utilities/formValidation
 */

// eslint-disable-next-line no-unused-vars -- Referenced by JSDoc types.
import express from "express";
import { body, param, validationResult } from "express-validator";

/**
 * Feedback stored in the session for one form page until it is displayed.
 * @typedef {object} FormFeedback
 * @property {Record<string, string>} errors First error message for each invalid field.
 * @property {Record<string, string>} values Submitted values to refill the form with.
 * @property {"create"|"update"|"delete"} action Action that was submitted.
 */

/**
 * Checks whether the submitted action writes field data.
 * @param {express.Request} req Incoming request.
 * @returns {boolean} True for create and update actions.
 */
const isWrite = (req) => ["create", "update"].includes(req.body?.action);

/**
 * Rejects arrays and objects that the urlencoded parser can produce from
 * repeated or bracketed field names.
 * @param {unknown} value Submitted value.
 * @returns {boolean} True for a string or safe integer.
 */
const isScalar = (value) =>
  typeof value === "string" || Number.isSafeInteger(value);

/** Largest value for a signed MySQL INT ID column. */
const maxId = 2147483647;

/**
 * Builds the action and record ID checks shared by management forms.
 * The ID is required for update and delete, and checked whenever it is in the URL.
 * @returns {ValidationChain[]} Validation chains.
 */
const managementFields = () => [
  body("action")
    .isString()
    .withMessage("Select a valid form action.")
    .bail()
    .isIn(["create", "update", "delete"])
    .withMessage("Select a valid form action."),
  param("id")
    .if(
      (_value, { req }) =>
        req.params.id !== undefined ||
        ["update", "delete"].includes(req.body?.action),
    )
    .custom(isScalar)
    .withMessage("A valid record ID is required for update or delete.")
    .bail()
    .isInt({ min: 1, max: maxId, allow_leading_zeroes: false })
    .withMessage("Record ID must be a positive integer."),
];

/**
 * Works out the GET page to return to after a failed submission.
 * Keeps a valid record ID and the query string so the user returns to the same
 * record, filters and page; anything else falls back to the base path.
 * @param {express.Request} req Incoming request.
 * @param {string} base Base form path, such as "/activities".
 * @returns {string} Path and query string of the form page.
 * @throws {Error} When the request URL is not under the base path.
 */
const feedbackPath = (req, base) => {
  const url = new URL(req.originalUrl, "http://localhost");
  if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) {
    throw new Error("Validation used outside a supported form route.");
  }
  const pathname =
    /^\/[1-9]\d*$/.test(url.pathname.slice(base.length)) &&
    Number(url.pathname.slice(base.length + 1)) <= maxId
      ? url.pathname
      : url.pathname === base
        ? url.pathname
        : base;
  return `${pathname}${url.search}`;
};

/**
 * Creates middleware that stops invalid submissions before the controller runs.
 *
 * When validation has failed, the first error per field and the listed values
 * are saved in `req.session.formFeedback`, keyed by the form page URL. The user
 * is then redirected (303) to that page, where the `formFeedback` middleware
 * displays them once. Valid requests continue to the next handler.
 * @param {string} path Base form path, such as "/authenticate".
 * @param {string[]} valueFields Fields whose values are refilled after an error.
 *   Leave out passwords and other sensitive fields.
 * @returns {express.RequestHandler} Express middleware.
 */
export const rejectInvalidForm = (path, valueFields) => (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  if (!req.session) {
    return next(new Error("Form validation requires session middleware."));
  }
  const destination = feedbackPath(req, path);
  const messages = Object.fromEntries(
    errors
      .array({ onlyFirstError: true })
      .map((error) => [error.path, error.msg]),
  );
  // Only listed fields are stored, so passwords are never kept in the session.
  const values = Object.fromEntries(
    valueFields.map((field) => [
      field,
      isScalar(req.body?.[field]) ? String(req.body[field]) : "",
    ]),
  );
  req.session.formFeedback = {
    ...req.session.formFeedback,
    [destination]: {
      errors: messages,
      values,
      action: ["create", "update", "delete"].includes(req.body?.action)
        ? req.body.action
        : "create",
    },
  };
  // Save before redirecting so the next GET request can read the feedback.
  req.session.save((error) => {
    if (error) {
      return next(error);
    }
    res.redirect(303, `${destination}#form-validation`);
  });
};

/**
 * Builds the validation middleware for a create, update and delete form.
 *
 * Runs the shared action and ID checks, then the controller's field rules for
 * create and update only (delete needs just a valid ID), then
 * {@link rejectInvalidForm}.
 * @example
 * static formValidation = management("/activities", ["name"], [
 *   body("name").isString().withMessage("Name must be text."),
 * ]);
 * @param {string} path Base form path, such as "/activities".
 * @param {string[]} valueFields Fields whose values are refilled after an error.
 * @param {ValidationChain[]} fields Field rules for create and update.
 * @param {Record<string, string>} [aliases] Map of camelCase field names to the
 *   snake_case names some forms post, such as `{ userId: "user_id" }`.
 * @returns {express.RequestHandler[]} Middleware to place before the route handler.
 */
export const management = (path, valueFields, fields, aliases = {}) => [
  // Copy snake_case values into the camelCase fields the rules check.
  (req, _res, next) => {
    for (const [field, alias] of Object.entries(aliases)) {
      if (req.body?.[field] == null && req.body?.[alias] !== undefined) {
        req.body[field] = req.body[alias];
      }
    }
    next();
  },
  ...managementFields(),
  async (req, res, next) => {
    if (isWrite(req)) {
      for (const field of fields) {
        await field.run(req);
      }
    }
    return rejectInvalidForm(path, valueFields)(req, res, next);
  },
];
