/** @type {import("express").RequestHandler} */
export const notFound = (req, res) => {
  res.status(404).render("status.ejs", {
    status: "404 - Page not found",
    message: "The page you requested does not exist. Please check the URL.",
    authenticatedUser: req.authenticatedUser,
    role: req.authenticatedUser?.role ?? "",
  });
};
