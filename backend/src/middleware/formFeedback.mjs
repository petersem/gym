// eslint-disable-next-line no-unused-vars -- Referenced by JSDoc types.
import express from "express";

/**
 * Makes saved validation feedback available to EJS views.
 *
 * Always sets defaults on `res.locals` so views can use them safely. On a GET
 * request whose URL matches feedback saved by `rejectInvalidForm`, the saved
 * errors, values and action are exposed instead, then removed from the session
 * so they only show once.
 *
 * Sets these `res.locals` properties:
 * - `formErrors`: messages keyed by field name.
 * - `formValues`: submitted values to refill fields with.
 * - `hasFormFeedback`: whether feedback is being shown.
 * - `formDestination`: current URL including the query string, used as the form action.
 * - `formAction`: action that was submitted ("create", "update" or "delete").
 * @type {express.RequestHandler}
 */
export const formFeedback = (req, res, next) => {
  res.locals.formErrors = {};
  res.locals.formValues = {};
  res.locals.hasFormFeedback = false;
  res.locals.formDestination = req.originalUrl;
  res.locals.formAction = "create";
  if (req.method === "GET" && req.session?.formFeedback) {
    const key = req.originalUrl;
    const feedback = req.session.formFeedback[key];
    if (feedback) {
      res.locals.formErrors = feedback.errors;
      res.locals.formValues = feedback.values;
      res.locals.hasFormFeedback = true;
      res.locals.formAction = feedback.action;
      delete req.session.formFeedback[key];
    }
  }
  next();
};
