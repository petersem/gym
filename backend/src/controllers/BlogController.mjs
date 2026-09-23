import express from "express";
import { BlogModel } from "../models/BlogModel.mjs";

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
  static async viewBlogManagement(req, res) {
    try {
      const blogs = await BlogModel.getAll();
      const selectedBlog = blogs.find((blog) => blog.id == req.params.id)
        ?? new BlogModel(null, "", "", 0, "", 0, 0);
      res.render("blog_management.ejs", { blogs, selectedBlog, role: "admin" });
    } catch (error) {
      res.status(500).render("status.ejs", { status: "Database Error", message: "Blog posts could not be loaded." });
    }
  }

  /** @type {import("express").RequestHandler} */
  static async handleBlogManagement(req, res) {
    const blog = new BlogModel(
      req.params.id ? Number(req.params.id) : null,
      req.body.title,
      req.body.content,
      Number(req.body.userId ?? req.body.user_id ?? 0),
      req.body.created,
      Number(req.body.deleted ?? 0),
      Number(req.body.updatedBy ?? req.body.updated_by ?? 0),
    );

    try {
      if (req.body.action === "create") {
        await BlogModel.create(blog);
        return res.redirect("/blogs");
      }
      if (req.body.action === "update") {
        const result = await BlogModel.update(blog);
        return result.affectedRows > 0
          ? res.redirect("/blogs")
          : res.status(404).render("status.ejs", { status: "Blog Update Failed", message: "The blog post could not be found." });
      }
      if (req.body.action === "delete") {
        const result = await BlogModel.delete(blog.id);
        return result.affectedRows > 0
          ? res.redirect("/blogs")
          : res.status(404).render("status.ejs", { status: "Blog Deletion Failed", message: "The blog post could not be found." });
      }
      return res.status(400).render("status.ejs", { status: "Invalid Action", message: "The form doesn't support this action." });
    } catch (error) {
      return res.status(500).render("status.ejs", { status: "Database Error", message: "The blog post could not be saved." });
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