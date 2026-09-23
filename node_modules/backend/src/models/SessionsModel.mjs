import { DatabaseModel } from "./DatabaseModel.mjs";

/**
 * Represents a persisted session in the sessions table.
 */
export class SessionsModel extends DatabaseModel {
  /**
   * @param {string} sid Session identifier.
   * @param {Object|string} data Serialized or parsed session data.
   * @param {string|Date} lastAccess Last access timestamp.
   * @param {string|Date} expires Session expiration timestamp.
   */
  constructor(sid, data, lastAccess, expires) {
    super();
    this.sid = sid;
    this.data = data;
    this.lastAccess = lastAccess;
    this.expires = expires;
  }

  /**
   * Convert a database row into a SessionsModel instance.
   * @param {Object} row Database row.
   * @returns {SessionsModel} Mapped session.
   */
  static tableToModel(row) {
    return new SessionsModel(row.sid, row.data, row.lastAccess, row.expires);
  }

  /**
   * Retrieve all sessions.
   * @returns {Promise<Array<SessionsModel>>} Stored sessions.
   */
  static async getAll() {
    return this.query("SELECT * FROM sessions").then(
      (result) => result.map((row) => this.tableToModel(row.sessions)),
    );
  }

  /**
   * Retrieve a session by its identifier.
   * @param {string} sid Session identifier.
   * @returns {Promise<SessionsModel>} Matching session.
   * @throws {string} "not found" when no session matches the identifier.
   */
  static async getById(sid) {
    const result = await this.query("SELECT * FROM sessions WHERE sid = ?", [sid]);
    return result.length > 0
      ? this.tableToModel(result[0].sessions)
      : Promise.reject("not found");
  }

  /**
   * Update an existing session.
   * @param {SessionsModel} session Session to update.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static update(session) {
    return this.query(
      `
            UPDATE sessions
            SET data = ?, lastAccess = ?, expires = ?
            WHERE sid = ?
        `,
      [session.data, session.lastAccess, session.expires, session.sid],
    );
  }

  /**
   * Create a session.
   * @param {SessionsModel} session Session to create.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static create(session) {
    return this.query(
      `
            INSERT INTO sessions (sid, data, lastAccess, expires)
            VALUES (?, ?, ?, ?)
        `,
      [session.sid, session.data, session.lastAccess, session.expires],
    );
  }

  /**
   * Delete a session by its identifier.
   * @param {string} sid Session identifier.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static delete(sid) {
    return this.query("DELETE FROM sessions WHERE sid = ?", [sid]);
  }
}