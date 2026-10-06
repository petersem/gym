/**
 * Handles unmatched routes by returning a 404 status page.
 *
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @returns {void}
 */
export const notFound = (req, res) => {
  res.status(404).render("status.ejs", {
    status: "404 - Page not found",
    message: "The page you requested does not exist. Please check the URL.",
    authenticatedUser: req.authenticatedUser,
    role: req.authenticatedUser?.role ?? "",
  });
};
