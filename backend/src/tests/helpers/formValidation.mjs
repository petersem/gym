import { AuthenticationController } from "../../controllers/AuthenticationController.mjs";
import { UsersController } from "../../controllers/UsersController.mjs";
import { LocationController } from "../../controllers/LocationController.mjs";
import { ActivitiesController } from "../../controllers/ActivitiesController.mjs";
import { BlogController } from "../../controllers/BlogController.mjs";
import { SessionsController } from "../../controllers/SessionsController.mjs";
import { BookingsController } from "../../controllers/BookingsController.mjs";

/** Validation middleware for each form, keyed by the name used in tests. */
export const formValidation = {
  login: AuthenticationController.loginValidation,
  register: AuthenticationController.registerValidation,
  users: UsersController.formValidation,
  locations: LocationController.formValidation,
  activities: ActivitiesController.formValidation,
  blogs: BlogController.formValidation,
  sessions: SessionsController.formValidation,
  bookings: BookingsController.formValidation,
};

/**
 * Runs a form's validation middleware in order without starting Express.
 * Fills in `originalUrl` and a session stub when the request does not have them.
 * @param {string} form Key of `formValidation` to run.
 * @param {object} req Mock request with `body` and optional `params`.
 * @param {object} res Mock response.
 * @returns {Promise<boolean>} True when every middleware called `next()`; false
 *   when validation redirected back to the form.
 */
export const runFormValidation = async (form, req, res) => {
  const base =
    form === "login"
      ? "/authenticate"
      : form === "register"
        ? "/authenticate/register"
        : `/${form}`;
  req.originalUrl ??= `${base}${req.params?.id ? `/${req.params.id}` : ""}`;
  req.session ??= {};
  req.session.save ??= (callback) => callback();
  for (const middleware of formValidation[form]) {
    let continued = false;
    await middleware(req, res, (error) => {
      if (error) {
        throw error;
      }
      continued = true;
    });
    if (!continued) {
      return false;
    }
  }
  return true;
};
