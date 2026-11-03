import express from "express";
import { UsersModel } from "../../models/UsersModel.mjs";
import { BlogModel } from "../../models/BlogModel.mjs";
import {
  buildResourcePaths,
  createResourceRouter,
} from "./apiResourceFactory.mjs";

/**
 * Configuration for the publicly readable `/blogs` resource: members and
 * trainers can create posts as themselves.
 */
const blogsResource = {
  path: "blogs",
  removedMethods: ["put", "delete"],
  schema: "Blog",
  listSchema: "BlogSummary",
  tag: "Blogs",
  model: BlogModel,
  roles: ["trainer", "member"],
  publicRead: true,
  query: {
    searchDescription: "title or content",
    sorts: ["created", "title"],
    defaultSort: "created",
    defaultDir: "desc",
  },
  description:
    "Guests, members and trainers can read posts; blog lists include the author's first name. Members and trainers can create posts as themselves, but posts cannot be updated or deleted through the API. Administrators have no API access.",

  /**
   * List blog posts with the author's first name.
   *
   * @returns {Promise<object[]>} Blog posts including `first_name`.
   */
  async loadList() {
    const [blogs, users] = await Promise.all([
      BlogModel.getAll(),
      UsersModel.getAll(),
    ]);
    const firstNames = new Map(
      users.map((user) => [Number(user.id), user.first_name]),
    );
    return blogs.map((blog) => ({
      ...blog,
      first_name: firstNames.get(Number(blog.user_id)) ?? null,
    }));
  },

  /**
   * Resolve the searchable and sortable values of a blog post.
   *
   * @returns {Promise<function(object): object>} Blog field mapper.
   */
  async fields() {
    return (blog) => ({
      search: [blog.title, blog.content],
      title: blog.title,
      created: new Date(blog.created).toISOString(),
    });
  },

  /**
   * Set the author and creation time of a post.
   *
   * @param {express.Request} req Request containing the authenticated user and body.
   * @param {object} [existing] Existing post, if any.
   * @returns {Promise<object>} Post ready to be written.
   */
  async prepare(req, existing) {
    const record = { ...existing, ...req.body, id: existing?.id ?? null };
    record.user_id = existing?.user_id ?? req.authenticatedUser.id;
    record.created = existing?.created ?? new Date();
    return record;
  },
};

/**
 * Registers API routes for blog posts.
 */
export class APIBlogsController {
  static routes = express.Router();

  /**
   * OpenAPI path definitions for the blog endpoints.
   *
   * @type {Record<string, object>}
   */
  static paths = buildResourcePaths(blogsResource);

  static {
    this.routes.use("/blogs", createResourceRouter(blogsResource));
  }
}
