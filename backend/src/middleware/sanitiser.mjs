import express from "express";
import { logDanger, logWarning, logInfo } from "../utilities/logger.mjs";

/**
 * Creates middleware that cleans, warns about, or rejects unsafe request body values.
 * @param {"clean"|"warn"|"reject"|"disable"} action Sanitisation behavior.
 * @returns {express.RequestHandler} Configured sanitiser middleware.
 */
export const sanitiser = function (action = "fail") {
  // options can be
  //      clean = to replace bad characters
  //      warn = log, but dont change anything
  //      reject = return a status 422 and dont process
  console.log(logInfo, `Sanitiser Middleware: Activated - Mode: ${action}`);

  return (req, res, next) => {
    if (req.body !== undefined) {
      if (action.toLowerCase() === "disable") {
        console.log(logInfo, `Sanitiser ** Disabled!`);
      } else {
        // Remove potentially dangerous characters
        for (const key of Object.keys(req.body)) {
          const testBad = /[$&+;=#|<>{}^*%]/.test(req.body[key]);
          // if bad characters found, print to the log and santisise bad data
          if (testBad) {
            const display = () => {
              if (process.env.NODE_ENV === "development") {
                console.log(logInfo, `Sanitiser (Mode: ${action})`);
                console.log(
                  logInfo,
                  `              -  From IP        ${req.connection.remoteAddress}`,
                );
                console.log(
                  logInfo,
                  `              -  Logged at:     ${new Date().toLocaleString()}`,
                );
                console.log(
                  logInfo,
                  `              -  Issue with:    body.${key}`,
                );
                console.log(
                  logInfo,
                  `              -  Original text: ${req.body[key]} `,
                );
              }
            };

            switch (action.toLowerCase()) {
              case "clean":
                display();
                req.body[key] = req.body[key].replace(
                  /[$&+,:;=?#|'<>.^*()%!-]/g,
                  "",
                );
                if (process.env.NODE_ENV === "development") {
                  console.log(
                    logInfo,
                    `                Sanitised to: ${req.body[key]} `,
                  );
                }
                break;
              case "warn":
                display();
                if (process.env.NODE_ENV === "development") {
                  console.log(logWarning, `             Warning only`);
                }
                break;
              case "reject": {
                const errorMessage = `Field: ${key} - '${req.body[key]}'`;
                //if (process.env.NODE_ENV === "development") {
                console.log(
                  logWarning,
                  `Sanitiser (Mode: ${action}) ${errorMessage}`,
                );
                //}
                return res.status(422).render("status.ejs", {
                  status: "Request Rejected",
                  message: errorMessage,
                  authenticatedUser: req.authenticatedUser,
                });
              }
              default:
                res.status(500);
                if (process.env.NODE_ENV === "development") {
                  console.log(
                    logDanger,
                    `Sanitiser (Mode: ${action}) You have NOT SELECTED A VALID OPTION for sanitiser - no action taken !!!`,
                  );
                }
                res
                  .setHeader("Content-Type", "application/json")
                  .status(500)
                  .json(
                    `{message: sanitiser middleware triggered, but using invalid option '${action}' - No action taken }`,
                  );
                return;
            }
          }
        }
      }
    }
    next();
  };
};
