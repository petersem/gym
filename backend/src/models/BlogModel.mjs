import { DatabaseModel } from "./DatabaseModel.mjs";

/**
 * Represents a blog post stored in the blog table.
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
      row.subject ?? row.title,
      row.body ?? row.content,
      Number(row.user_id),
      row.create_date ?? row.created,
      row.deleted ?? 0,
      row.updated_by == null ? null : Number(row.updated_by),
    );
  }

  /**
  * Retrieve all blog posts.
   * @returns {Promise<Array<BlogModel>>} Active blog posts.
   */
  static async getAll() {
    return this.query("SELECT * FROM blog ORDER BY create_date DESC, id DESC").then(
      (result) => result.map((row) => this.tableToModel(row.blog)),
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
            SELECT * FROM blog
            WHERE subject LIKE ? OR body LIKE ?
        `,
      [`%${term}%`, `%${term}%`],
    ).then((result) => result.map((row) => this.tableToModel(row.blog)));
  }

  /**
   * Retrieve a blog post by its identifier.
   * @param {number} id Blog post identifier.
   * @returns {Promise<BlogModel>} Matching blog post.
   * @throws {string} "not found" when no post matches the identifier.
   */
  static async getById(id) {
    const result = await this.query("SELECT * FROM blog WHERE id = ?", [id]);
    return result.length > 0
      ? this.tableToModel(result[0].blog)
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
            UPDATE blog
            SET subject = ?, body = ?, user_id = ?
            WHERE id = ?
        `,
      [
        blog.title,
        blog.content,
        blog.user_id,
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
            INSERT INTO blog
            (subject, body, user_id, create_date)
            VALUES (?, ?, ?, ?)
        `,
          [blog.title, blog.content, blog.user_id, blog.created],
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
            INSERT INTO blog
            (id, subject, body, user_id, create_date)
            VALUES (?, ?, ?, ?, ?)
        `,
      [
        blog.id,
        blog.title,
        blog.content,
        blog.user_id,
        blog.created,
      ],
    );
  }

  /**
   * Delete a blog post by its identifier.
   * @param {number} id Blog post identifier.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static delete(id) {
    return this.query("DELETE FROM blog WHERE id = ?", [id]);
  }
}