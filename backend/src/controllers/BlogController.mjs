import express from "express";
import { BlogModel } from "../models/BlogModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";

/** HTTP handlers for blog posts. */
export class BlogController {
  /** @type {import("express").Router} */
  static routes = express.Router();

  static {
    this.routes.get("/", this.viewBlogManagement);
    this.routes.get("/:id", this.viewBlogManagement);
    this.routes.post("/", this.handleBlogManagement);
    this.routes.post("/:id", this.handleBlogManagement);
  }

  /** @type {import("express").RequestHandler} */
  static viewBlogManagement(req, res) {
    const selectedSearchTerm = String(req.query.search_term ?? "").trim();
    const selectedSortBy = Object.keys(BlogModel.SORTABLE_COLUMNS).includes(req.query.sort_by)
      ? req.query.sort_by : "created";
    const selectedSortDir = req.query.sort_dir === "asc" ? "asc" : "desc";
    const pageSize = 20;
    const selectedPage = Math.max(1, Number(req.query.page) || 1);
    const blogsPromise = BlogModel.list({
      searchTerm: selectedSearchTerm, sortBy: selectedSortBy, sortDir: selectedSortDir,
      page: selectedPage, pageSize,
    });
    return Promise.all([blogsPromise, UsersModel.getAll()])
      .then(([{ blogs, total }, users]) => {
      const selectedBlog = blogs.find((blog) => blog.id == req.params.id)
        ?? new BlogModel(null, "", "", 0, "", 0, 0);
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
        res.status(500).render("status.ejs", { status: "Database Error", message: "Blog posts could not be loaded." });
      });
  }

  /** @type {import("express").RequestHandler} */
  static handleBlogManagement(req, res) {
    const authenticatedUserId = Number(req.authenticatedUser?.id);
    if (req.body.action === "create" && (!Number.isInteger(authenticatedUserId) || authenticatedUserId <= 0)) {
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
          res.status(500).render("status.ejs", { status: "Database Error", message: "The blog post could not be created." });
        });
    } else if (req.body.action === "update") {
      return BlogModel.update(blog)
        .then((result) => result.affectedRows > 0
          ? res.redirect("/blogs")
          : res.status(404).render("status.ejs", { status: "Blog Update Failed", message: "The blog post could not be found." }))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", { status: "Database Error", message: "The blog post could not be updated." });
        });
    } else if (req.body.action === "delete") {
      return BlogModel.getById(blog.id)
        .then((existingBlog) => {
          const canDelete = req.authenticatedUser && (
            req.authenticatedUser.role === "admin"
            || Number(req.authenticatedUser.id) === Number(existingBlog.user_id)
          );
          if (!canDelete) {
            return res.status(req.authenticatedUser ? 403 : 401).render("status.ejs", {
              status: req.authenticatedUser ? "Access Forbidden" : "Unauthenticated",
              message: req.authenticatedUser
                ? "You can only delete your own posts."
                : "Please log in before deleting a blog post.",
            });
          }
          return BlogModel.delete(blog.id)
            .then((result) => result.affectedRows > 0
              ? res.redirect("/blogs")
              : res.status(404).render("status.ejs", { status: "Blog Deletion Failed", message: "The blog post could not be found." }));
        })
        .catch((error) => {
          if (error === "not found") {
            return res.status(404).render("status.ejs", { status: "Blog Deletion Failed", message: "The blog post could not be found." });
          }
          console.error(error);
          res.status(500).render("status.ejs", { status: "Database Error", message: "The blog post could not be deleted." });
        });
    } else {
      res.status(400).render("status.ejs", { status: "Invalid Action", message: "The form doesn't support this action." });
    }
  }

  /** @type {import("express").RequestHandler} */
  static async list(req, res, next) {
    try {
      const blogs = req.query.search_term
        ? await BlogModel.getBySearch(req.query.search_term)
        : await BlogModel.getAll();
      res.json(blogs);
    } catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async getById(req, res, next) {
    try { res.json(await BlogModel.getById(Number(req.params.id))); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async create(req, res, next) {
    try { res.status(201).json(await BlogModel.create(req.body)); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async update(req, res, next) {
    try { res.json(await BlogModel.update({ ...req.body, id: Number(req.params.id) })); }
    catch (error) { next(error); }
  }

  /** @type {import("express").RequestHandler} */
  static async delete(req, res, next) {
    try { res.json(await BlogModel.delete(Number(req.params.id))); }
    catch (error) { next(error); }
  }
}