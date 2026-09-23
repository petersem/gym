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
   * @param {string|number} updatedBy User who last updated the activity.
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