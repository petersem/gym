import express from "express";
import { BlogModel } from "../models/BlogModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { body } from "express-validator";
import { management } from "../utilities/formValidation.mjs";

const canManageBlog = (user, blog) =>
  Boolean(
    user && (user.role === "admin" || Number(user.id) === Number(blog.user_id)),
  );

/** HTTP handlers for blog posts. */
export class BlogController {
  /** @type {express.Router} */
  static routes = express.Router();

  /**
   * Validation for the blog post form. Field rules run for create and update
   * only; limits match the blog table columns.
   * @type {express.RequestHandler[]}
   */
  static formValidation = management(
    "/blogs",
    ["title", "content", "userId"],
    [
      body("title")
        .isString()
        .withMessage("Title must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("Title must contain 1-100 characters."),
      body("content")
        .isString()
        .withMessage("Content must be text.")
        .bail()
        .trim()
        .isLength({ min: 1, max: 250 })
        .withMessage("Content must contain 1-250 characters."),
      body("userId")
        .optional()
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Author must be a valid number.")
        .bail()
        .isInt({ min: 1, max: 2147483647, allow_leading_zeroes: false })
        .withMessage("Author must be an integer between 1 and 2147483647."),
      body("deleted")
        .optional()
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Deleted must be a valid number.")
        .bail()
        .isInt({ min: 0, max: 1, allow_leading_zeroes: false })
        .withMessage("Deleted must be an integer between 0 and 1."),
      body("updatedBy")
        .optional()
        .custom(
          (value) => typeof value === "string" || Number.isSafeInteger(value),
        )
        .withMessage("Updated by must be a valid number.")
        .bail()
        .isInt({ min: 0, max: 2147483647, allow_leading_zeroes: false })
        .withMessage("Updated by must be an integer between 0 and 2147483647."),
    ],
    { userId: "user_id", updatedBy: "updated_by" },
  );

  static {
    this.routes.get("/", this.viewBlogManagement);
    this.routes.get("/:id", this.viewBlogManagement);
    this.routes.post("/", this.formValidation, this.handleBlogManagement);
    this.routes.post("/:id", this.formValidation, this.handleBlogManagement);
  }

  /**
   * Renders the blog page with a searched, sorted and paginated list of posts.
   * Loads the post in the URL into the edit form, even when it is not on the
   * current page.
   * @type {express.RequestHandler}
   */
  static viewBlogManagement(req, res) {
    const selectedSearchTerm = String(req.query.search_term ?? "").trim();
    const selectedSortBy = Object.keys(BlogModel.SORTABLE_COLUMNS).includes(
      req.query.sort_by,
    )
      ? req.query.sort_by
      : "created";
    const selectedSortDir = req.query.sort_dir === "asc" ? "asc" : "desc";
    const pageSize = 20;
    const selectedPage = Math.max(1, Number(req.query.page) || 1);
    const blogsPromise = BlogModel.list({
      searchTerm: selectedSearchTerm,
      sortBy: selectedSortBy,
      sortDir: selectedSortDir,
      page: selectedPage,
      pageSize,
    });
    return Promise.all([blogsPromise, UsersModel.getAll()])
      .then(async ([{ blogs, total }, users]) => {
        const selectedBlog =
          blogs.find((blog) => String(blog.id) === req.params.id) ??
          (req.params.id
            ? await BlogModel.getById(req.params.id).catch(() => null)
            : null) ??
          new BlogModel(null, "", "", 0, "", 0, 0);
        res.render("blog_management.ejs", {
          blogs,
          users,
          selectedBlog,
          selectedSearchTerm,
          selectedSortBy,
          selectedSortDir,
          selectedPage,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          authenticatedUser: req.authenticatedUser,
          role: "admin",
        });
      })
      .catch((error) => {
        console.error(error);
        res.status(500).render("status.ejs", {
          status: "Database Error",
          message: "Blog posts could not be loaded.",
        });
      });
  }

  /**
   * Creates, updates or deletes a blog post from the validated form.
   * @type {express.RequestHandler}
   */
  static handleBlogManagement(req, res) {
    const authenticatedUserId = Number(req.authenticatedUser?.id);
    if (
      req.body.action === "create" &&
      (!Number.isInteger(authenticatedUserId) || authenticatedUserId <= 0)
    ) {
      return res.status(401).render("status.ejs", {
        status: "Unauthenticated",
        message: "Please log in before creating a blog post.",
      });
    }

    const blog = new BlogModel(
      req.params.id ? Number(req.params.id) : null,
      req.body.title,
      req.body.content,
      req.body.action === "create"
        ? authenticatedUserId
        : Number(req.body.userId ?? req.body.user_id ?? 0),
      req.body.action === "create" ? new Date() : undefined,
      Number(req.body.deleted ?? 0),
      Number(req.body.updatedBy ?? req.body.updated_by ?? 0),
    );

    if (req.body.action === "create") {
      return BlogModel.create(blog)
        .then(() => res.redirect("/blogs"))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The blog post could not be created.",
          });
        });
    } else if (req.body.action === "update") {
      if (!req.authenticatedUser) {
        return res.status(401).render("status.ejs", {
          status: "Unauthenticated",
          message: "Please log in before updating a blog post.",
        });
      }
      return BlogModel.getById(blog.id)
        .then((existingBlog) => {
          if (!canManageBlog(req.authenticatedUser, existingBlog)) {
            return res.status(403).render("status.ejs", {
              status: "Access Forbidden",
              message: "You can only update your own posts.",
            });
          }
          if (req.authenticatedUser.role !== "admin") {
            blog.user_id = existingBlog.user_id;
          }
          return BlogModel.update(blog).then((result) =>
            result.affectedRows > 0
              ? res.redirect("/blogs")
              : res.status(404).render("status.ejs", {
                  status: "Blog Update Failed",
                  message: "The blog post could not be found.",
                }),
          );
        })
        .catch((error) => {
          if (error === "not found") {
            return res.status(404).render("status.ejs", {
              status: "Blog Update Failed",
              message: "The blog post could not be found.",
            });
          }
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The blog post could not be updated.",
          });
        });
    } else if (req.body.action === "delete") {
      if (!req.authenticatedUser) {
        return res.status(401).render("status.ejs", {
          status: "Unauthenticated",
          message: "Please log in before deleting a blog post.",
        });
      }
      return BlogModel.getById(blog.id)
        .then((existingBlog) => {
          if (!canManageBlog(req.authenticatedUser, existingBlog)) {
            return res.status(403).render("status.ejs", {
              status: "Access Forbidden",
              message: "You can only delete your own posts.",
            });
          }
          return BlogModel.delete(blog.id).then((result) =>
            result.affectedRows > 0
              ? res.redirect("/blogs")
              : res.status(404).render("status.ejs", {
                  status: "Blog Deletion Failed",
                  message: "The blog post could not be found.",
                }),
          );
        })
        .catch((error) => {
          if (error === "not found") {
            return res.status(404).render("status.ejs", {
              status: "Blog Deletion Failed",
              message: "The blog post could not be found.",
            });
          }
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The blog post could not be deleted.",
          });
        });
    } else {
      res.status(400).render("status.ejs", {
        status: "Invalid Action",
        message: "The form doesn't support this action.",
      });
    }
  }

  /** @type {express.RequestHandler} */
  static async list(req, res, next) {
    try {
      const blogs = req.query.search_term
        ? await BlogModel.getBySearch(req.query.search_term)
        : await BlogModel.getAll();
      res.json(blogs);
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async getById(req, res, next) {
    try {
      res.json(await BlogModel.getById(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async create(req, res, next) {
    try {
      res.status(201).json(await BlogModel.create(req.body));
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async update(req, res, next) {
    try {
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required." });
      }
      const id = Number(req.params.id);
      const existingBlog = await BlogModel.getById(id);
      if (!canManageBlog(req.authenticatedUser, existingBlog)) {
        return res.status(403).json({ message: "Access forbidden." });
      }
      const userId =
        req.authenticatedUser.role === "admin"
          ? (req.body.user_id ?? existingBlog.user_id)
          : existingBlog.user_id;
      res.json(await BlogModel.update({ ...req.body, id, user_id: userId }));
    } catch (error) {
      if (error === "not found") {
        return res.status(404).json({ message: "Blog post not found." });
      }
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async delete(req, res, next) {
    try {
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required." });
      }
      const id = Number(req.params.id);
      const existingBlog = await BlogModel.getById(id);
      if (!canManageBlog(req.authenticatedUser, existingBlog)) {
        return res.status(403).json({ message: "Access forbidden." });
      }
      res.json(await BlogModel.delete(Number(req.params.id)));
    } catch (error) {
      if (error === "not found") {
        return res.status(404).json({ message: "Blog post not found." });
      }
      next(error);
    }
  }
}
