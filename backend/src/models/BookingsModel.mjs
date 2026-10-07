import { DatabaseModel } from "./DatabaseModel.mjs";

/**
 * Represents a booking stored in the bookings table.
 */
export class BookingsModel extends DatabaseModel {
  /**
   * @param {number|null} id Booking identifier.
   * @param {string} sessionId Session identifier.
   * @param {number} userId User identifier.
   * @param {string|Date} created Booking creation timestamp.
   */
  constructor(id, sessionId, userId, created) {
    super();
    this.id = id;
    this.session_id = sessionId;
    this.user_id = userId;
    this.created = created;
  }

  /**
   * Convert a database row into a BookingsModel instance.
   * @param {Object} row Database row.
   * @returns {BookingsModel} Mapped booking.
   */
  static tableToModel(row) {
    return new BookingsModel(
      Number(row.id),
      row.session_id,
      Number(row.user_id),
      row.created,
    );
  }

  /**
   * Retrieve all bookings.
   * @returns {Promise<Array<BookingsModel>>} Stored bookings.
   */
  static async getAll() {
    return this.query("SELECT * FROM bookings").then((result) =>
      result.map((row) => this.tableToModel(row.bookings)),
    );
  }

  /**
   * Retrieve bookings belonging to one user.
   * @param {number} userId User identifier.
   * @returns {Promise<Array<BookingsModel>>} The user's bookings.
   */
  static async getByUserId(userId) {
    return this.query("SELECT * FROM bookings WHERE user_id = ?", [
      userId,
    ]).then((result) => result.map((row) => this.tableToModel(row.bookings)));
  }

  /**
   * Retrieve bookings belonging to one session.
   * @param {number} sessionId Session identifier.
   * @returns {Promise<Array<BookingsModel>>} The session's bookings.
   */
  static async getBySessionId(sessionId) {
    return this.query("SELECT * FROM bookings WHERE session_id = ?", [
      sessionId,
    ]).then((result) => result.map((row) => this.tableToModel(row.bookings)));
  }

  /**
   * Delete every booking belonging to one session.
   * @param {number} sessionId Session identifier.
   * @returns {Promise<OkPacket>} Database result.
   */
  static deleteBySessionId(sessionId) {
    return this.query("DELETE FROM bookings WHERE session_id = ?", [sessionId]);
  }

  /**
   * Retrieve a booking by its identifier.
   * @param {number} id Booking identifier.
   * @returns {Promise<BookingsModel>} Matching booking.
   * @throws {string} "not found" when no booking matches the identifier.
   */
  static async getById(id) {
    const result = await this.query("SELECT * FROM bookings WHERE id = ?", [
      id,
    ]);
    return result.length > 0
      ? this.tableToModel(result[0].bookings)
      : Promise.reject("not found");
  }

  /**
   * Check whether a user already booked a session.
   * @param {number|string} sessionId Session identifier.
   * @param {number} userId User identifier.
   * @returns {Promise<boolean>} Whether the matching booking exists.
   */
  static async existsForSessionUser(sessionId, userId) {
    const result = await this.query(
      "SELECT id FROM bookings WHERE session_id = ? AND user_id = ? LIMIT 1",
      [sessionId, userId],
    );
    return result.length > 0;
  }

  /**
   * Check for another booking at the destination session's date and start time.
   * @param {BookingsModel} booking Destination booking; its ID is excluded on edits.
   * @returns {Promise<boolean>} Whether the user's schedule conflicts.
   */
  static async hasStartTimeConflict(booking) {
    const result = await this.query(
      `SELECT b.id FROM bookings b
       JOIN sessions booked ON booked.id = b.session_id
       JOIN sessions target ON target.id = ?
       WHERE b.user_id = ? AND booked.date = target.date
         AND booked.time = target.time AND (? IS NULL OR b.id <> ?)
       LIMIT 1`,
      [
        booking.session_id,
        booking.user_id,
        booking.id ?? null,
        booking.id ?? null,
      ],
    );
    return result.length > 0;
  }

  /**
   * Update an existing booking.
   * @param {BookingsModel} booking Booking to update.
   * @returns {Promise<OkPacket | {affectedRows: 0, overlap: true}>} Write result or conflict marker.
   */
  static async update(booking) {
    if (await this.hasStartTimeConflict(booking)) {
      return { affectedRows: 0, overlap: true };
    }
    return this.query(
      `
            UPDATE bookings
            SET session_id = ?, user_id = ?
            WHERE id = ?
        `,
      [booking.session_id, booking.user_id, booking.id],
    );
  }

  /**
   * Create a booking with a generated identifier.
   * @param {BookingsModel} booking Booking to create.
   * @returns {Promise<OkPacket | {affectedRows: 0, duplicate: true} | {affectedRows: 0, overlap: true}>} Insert result or conflict marker.
   */
  static async create(booking) {
    if (await this.existsForSessionUser(booking.session_id, booking.user_id)) {
      return { affectedRows: 0, duplicate: true };
    }
    if (await this.hasStartTimeConflict({ ...booking, id: null })) {
      return { affectedRows: 0, overlap: true };
    }

    return this.query(
      `
            INSERT INTO bookings (session_id, user_id, created)
            VALUES (?, ?, ?)
        `,
      [booking.session_id, booking.user_id, booking.created],
    );
  }

  /**
   * Create a booking with a caller-provided identifier.
   * @param {BookingsModel} booking Booking to create.
   * @returns {Promise<OkPacket>} Database result.
   */
  static createWithExistingID(booking) {
    return this.query(
      `
            INSERT INTO bookings (id, session_id, user_id, created)
            VALUES (?, ?, ?, ?)
        `,
      [booking.id, booking.session_id, booking.user_id, booking.created],
    );
  }

  /**
   * Delete a booking by its identifier.
   * @param {number} id Booking identifier.
   * @returns {Promise<OkPacket>} Database result.
   */
  static delete(id) {
    return this.query("DELETE FROM bookings WHERE id = ?", [id]);
  }
}
