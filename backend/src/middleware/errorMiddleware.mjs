import { logDanger, logWarning, logInfo } from "../utilities/logger.mjs";

/**
 * ### Defines the errorMiddleware function
 * Reads the process.env to determine if environment is development or not. If not development, stack traces will not be shown.
 * @returns {Function}
 */
export const errorMiddleware = function () {
  console.log(logInfo, `Error Middleware: Activated`);

  return (err, req, res, next) => {
    if (process.env?.NODE_ENV === "development") {
      console.log(logDanger, err);
    } else {
      console.log(logDanger, err.message);
    }
    const statusCode = res.statusCode >= 400 ? res.statusCode : 500;
    res.status(statusCode);
    res.json({
      message: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : null,
    });
  };
};
