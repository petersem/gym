import { DatabaseModel } from "./DatabaseModel.mjs";

/**
 * Represents a gym session stored in the sessions table.
 */
export class SessionsModel extends DatabaseModel {
  /**
   * @param {number|null} id Session identifier.
   * @param {number} activityId Activity identifier.
   * @param {number} locationId Location identifier.
   * @param {number} trainerId Trainer user identifier.
   * @param {string|Date} date Session date.
   * @param {string} time Session time.
   * @param {string} title Session title.
   */
  constructor(id, activityId, locationId, trainerId, date, time, title = "") {
    super();
    this.id = id;
    this.activity_id = activityId;
    this.location_id = locationId;
    this.trainer_id = trainerId;
    this.date = date;
    this.time = time;
    this.title = title;
  }

  /**
   * Convert a database row into a SessionsModel instance.
   * @param {Object} row Database row.
   * @returns {SessionsModel} Mapped session.
   */
  static tableToModel(row) {
    return new SessionsModel(
      Number(row.id),
      Number(row.activity_id),
      Number(row.location_id),
      Number(row.trainer_id),
      row.date,
      row.time,
      row.title,
    );
  }

  /**
   * Retrieve all sessions.
   * @returns {Promise<Array<SessionsModel>>} Stored sessions.
   */
  static async getAll() {
    return this.query("SELECT * FROM sessions").then((result) =>
      result.map((row) => this.tableToModel(row.sessions)),
    );
  }

  /**
   * Retrieve a session by its identifier.
   * @param {string} sid Session identifier.
   * @returns {Promise<SessionsModel>} Matching session.
   * @throws {string} "not found" when no session matches the identifier.
   */
  static async getById(id) {
    const result = await this.query("SELECT * FROM sessions WHERE id = ?", [
      id,
    ]);
    return result.length > 0
      ? this.tableToModel(result[0].sessions)
      : Promise.reject("not found");
  }

  /**
   * Check for another session assigned to this trainer at the same date/time.
   * @param {SessionsModel} session Destination session.
   * @returns {Promise<boolean>} Whether the trainer is already scheduled.
   */
  static async hasTrainerConflict(session) {
    const result = await this.query(
      `SELECT id FROM sessions WHERE trainer_id = ? AND date = ? AND time = ?
       AND (? IS NULL OR id <> ?) LIMIT 1`,
      [
        session.trainer_id,
        session.date,
        session.time,
        session.id ?? null,
        session.id ?? null,
      ],
    );
    return result.length > 0;
  }

  /**
   * Update an existing session.
   * @param {SessionsModel} session Session to update.
   * @returns {Promise<OkPacket | {affectedRows: 0, trainerConflict: true}>} Write result or scheduling conflict.
   */
  static async update(session) {
    if (await this.hasTrainerConflict(session)) {
      return { affectedRows: 0, trainerConflict: true };
    }
    return this.query(
      `
            UPDATE sessions
            SET title = ?, activity_id = ?, location_id = ?, trainer_id = ?, date = ?, time = ?
            WHERE id = ?
        `,
      [
        session.title,
        session.activity_id,
        session.location_id,
        session.trainer_id,
        session.date,
        session.time,
        session.id,
      ],
    );
  }

  /**
   * Create a session.
   * @param {SessionsModel} session Session to create.
   * @returns {Promise<OkPacket | {affectedRows: 0, trainerConflict: true}>} Write result or scheduling conflict.
   */
  static async create(session) {
    if (await this.hasTrainerConflict({ ...session, id: null })) {
      return { affectedRows: 0, trainerConflict: true };
    }
    return this.query(
      `
            INSERT INTO sessions (title, activity_id, location_id, trainer_id, date, time)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      [
        session.title,
        session.activity_id,
        session.location_id,
        session.trainer_id,
        session.date,
        session.time,
      ],
    );
  }

  /**
   * Delete a session by its identifier.
   * @param {string} sid Session identifier.
   * @returns {Promise<OkPacket>} Database result.
   */
  static delete(id) {
    return this.query("DELETE FROM sessions WHERE id = ?", [id]);
  }
}
