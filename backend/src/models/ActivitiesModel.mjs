import { DatabaseModel } from "./DatabaseModel.mjs";

/**
 * Represents an activity stored in the activities table.
 */
export class ActivitiesModel extends DatabaseModel {
  /**
   * @param {number|null} id Activity identifier.
   * @param {string} name Activity name.
   * @param {string} description Activity description.
   * @param {number} deleted Soft-delete flag.
   * @param {number} updatedBy ID of the user who last updated the activity.
   */
  constructor(id, name, description, deleted, updatedBy) {
    super();
    this.id = id;
    this.name = name;
    this.description = description;
    this.deleted = deleted;
    this.updated_by = updatedBy;
  }

  /**
   * Convert a database row into an ActivitiesModel instance.
   * @param {Object} row Database row.
   * @returns {ActivitiesModel} Mapped activity.
   */
  static tableToModel(row) {
    return new ActivitiesModel(
      Number(row.id),
      row.name,
      row.description,
      row.deleted,
      row.updated_by,
    );
  }

  /**
   * Retrieve all non-deleted activities.
   * @returns {Promise<Array<ActivitiesModel>>} Active activities.
   */
  static async getAll() {
    return this.query("SELECT * FROM activities WHERE deleted = 0").then(
      (result) => result.map((row) => this.tableToModel(row.activities)),
    );
  }

  /**
   * Search non-deleted activities by name or description.
   * @param {string} term Search term.
   * @returns {Promise<Array<ActivitiesModel>>} Matching activities.
   */
  static async getBySearch(term) {
    return this.query(
      `
            SELECT * FROM activities
            WHERE deleted = 0
            AND (name LIKE ? OR description LIKE ?)
        `,
      [`%${term}%`, `%${term}%`],
    ).then((result) => result.map((row) => this.tableToModel(row.activities)));
  }

  /** Columns that may be used to sort activity listings. */
  static SORTABLE_COLUMNS = { name: "name", description: "description" };

  /**
   * Search and sort non-deleted activities server-side.
   * @param {Object} [options] Search and sort options.
   * @param {string} [options.searchTerm] Optional search term for name/description.
   * @param {string} [options.sortBy] Column to sort by (name|description).
   * @param {string} [options.sortDir] Sort direction (asc|desc).
   * @param {number} [options.page] 1-indexed page number for pagination.
   * @param {number} [options.pageSize] Number of rows per page.
   * @returns {Promise<{ activities: Array<ActivitiesModel>, total: number }>} Matching activities and total match count.
   */
  static async list({
    searchTerm = "", sortBy = "name", sortDir = "asc", page = 1, pageSize = null,
  } = {}) {
    const column = this.SORTABLE_COLUMNS[sortBy] ?? this.SORTABLE_COLUMNS.name;
    const direction = sortDir === "desc" ? "DESC" : "ASC";
    const where = ["deleted = 0"];
    const values = [];
    if (searchTerm) {
      where.push("(name LIKE ? OR description LIKE ?)");
      values.push(`%${searchTerm}%`, `%${searchTerm}%`);
    }
    const whereClause = where.join(" AND ");
    const countResult = await this.query(`SELECT COUNT(*) AS total FROM activities WHERE ${whereClause}`, values);
    const total = Number(countResult[0]?.[""]?.total ?? 0);
    const limitClause = pageSize ? "LIMIT ? OFFSET ?" : "";
    const limitValues = pageSize ? [pageSize, (Math.max(1, page) - 1) * pageSize] : [];
    const activities = await this.query(
      `SELECT * FROM activities WHERE ${whereClause} ORDER BY ${column} ${direction} ${limitClause}`,
      [...values, ...limitValues],
    ).then((result) => result.map((row) => this.tableToModel(row.activities)));
    return { activities, total };
  }

  /**
   * Retrieve an activity by its identifier.
   * @param {number} id Activity identifier.
   * @returns {Promise<ActivitiesModel>} Matching activity.
   * @throws {string} "not found" when no activity matches the identifier.
   */
  static async getById(id) {
    const result = await this.query("SELECT * FROM activities WHERE id = ?", [id]);
    return result.length > 0
      ? this.tableToModel(result[0].activities)
      : Promise.reject("not found");
  }

  /**
   * Update an existing activity.
   * @param {ActivitiesModel} activity Activity to update.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static update(activity) {
    return this.query(
      `
            UPDATE activities
            SET name = ?, description = ?, deleted = ?, updated_by = ?
            WHERE id = ?
        `,
      [
        activity.name,
        activity.description,
        activity.deleted,
        activity.updated_by,
        activity.id,
      ],
    );
  }

  /**
   * Create an activity with a generated identifier.
   * @param {ActivitiesModel} activity Activity to create.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static create(activity) {
    return this.query(
      `
            INSERT INTO activities
            (name, description, deleted, updated_by)
            VALUES (?, ?, ?, ?)
        `,
      [activity.name, activity.description, activity.deleted, activity.updated_by],
    );
  }

  /**
   * Create an activity with a caller-provided identifier.
   * @param {ActivitiesModel} activity Activity to create.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static createWithExistingID(activity) {
    return this.query(
      `
            INSERT INTO activities
            (id, name, description, deleted, updated_by)
            VALUES (?, ?, ?, ?, ?)
        `,
      [
        activity.id,
        activity.name,
        activity.description,
        activity.deleted,
        activity.updated_by,
      ],
    );
  }

  /**
   * Delete an activity by its identifier.
   * @param {number} id Activity identifier.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static delete(id) {
    return this.query("DELETE FROM activities WHERE id = ?", [id]);
  }
}