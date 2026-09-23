import { DatabaseModel } from "./DatabaseModel.mjs";

/**
 * Represents a blog post stored in the blogs table.
 */
export class BlogModel extends DatabaseModel {
  /**
   * @param {number|null} id Blog post identifier.
   * @param {string} title Blog post title.
   * @param {string} content Blog post content.
   * @param {number} userId ID of the user who authored the post.
   * @param {string|Date} created Blog post creation timestamp.
   * @param {number} deleted Soft-delete flag.
   * @param {number} updatedBy ID of the user who last updated the post.
   */
  constructor(id, title, content, userId, created, deleted, updatedBy) {
    super();
    this.id = id;
    this.title = title;
    this.content = content;
    this.user_id = userId;
    this.created = created;
    this.deleted = deleted;
    this.updated_by = updatedBy;
  }

  /**
   * Convert a database row into a BlogModel instance.
   * @param {Object} row Database row.
   * @returns {BlogModel} Mapped blog post.
   */
  static tableToModel(row) {
    return new BlogModel(
      Number(row.id),
      row.title,
      row.content,
      Number(row.user_id),
      row.created,
      row.deleted,
      Number(row.updated_by),
    );
  }

  /**
   * Retrieve all non-deleted blog posts.
   * @returns {Promise<Array<BlogModel>>} Active blog posts.
   */
  static async getAll() {
    return this.query("SELECT * FROM blogs WHERE deleted = 0").then(
      (result) => result.map((row) => this.tableToModel(row.blogs)),
    );
  }

  /**
   * Search non-deleted blog posts by title or content.
   * @param {string} term Search term.
   * @returns {Promise<Array<BlogModel>>} Matching blog posts.
   */
  static async getBySearch(term) {
    return this.query(
      `
            SELECT * FROM blogs
            WHERE deleted = 0
            AND (title LIKE ? OR content LIKE ?)
        `,
      [`%${term}%`, `%${term}%`],
    ).then((result) => result.map((row) => this.tableToModel(row.blogs)));
  }

  /**
   * Retrieve a blog post by its identifier.
   * @param {number} id Blog post identifier.
   * @returns {Promise<BlogModel>} Matching blog post.
   * @throws {string} "not found" when no post matches the identifier.
   */
  static async getById(id) {
    const result = await this.query("SELECT * FROM blogs WHERE id = ?", [id]);
    return result.length > 0
      ? this.tableToModel(result[0].blogs)
      : Promise.reject("not found");
  }

  /**
   * Update an existing blog post.
   * @param {BlogModel} blog Blog post to update.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static update(blog) {
    return this.query(
      `
            UPDATE blogs
            SET title = ?, content = ?, user_id = ?, created = ?, deleted = ?, updated_by = ?
            WHERE id = ?
        `,
      [
        blog.title,
        blog.content,
        blog.user_id,
        blog.created,
        blog.deleted,
        blog.updated_by,
        blog.id,
      ],
    );
  }

  /**
   * Create a blog post with a generated identifier.
   * @param {BlogModel} blog Blog post to create.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static create(blog) {
    return this.query(
      `
            INSERT INTO blogs
            (title, content, user_id, created, deleted, updated_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      [blog.title, blog.content, blog.user_id, blog.created, blog.deleted, blog.updated_by],
    );
  }

  /**
   * Create a blog post with a caller-provided identifier.
   * @param {BlogModel} blog Blog post to create.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static createWithExistingID(blog) {
    return this.query(
      `
            INSERT INTO blogs
            (id, title, content, user_id, created, deleted, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      [
        blog.id,
        blog.title,
        blog.content,
        blog.user_id,
        blog.created,
        blog.deleted,
        blog.updated_by,
      ],
    );
  }

  /**
   * Delete a blog post by its identifier.
   * @param {number} id Blog post identifier.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static delete(id) {
    return this.query("DELETE FROM blogs WHERE id = ?", [id]);
  }
}