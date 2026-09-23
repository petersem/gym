import { DatabaseModel } from "./DatabaseModel.mjs";

/**
 * Represents a booking stored in the bookings table.
 */
export class BooksingModel extends DatabaseModel {
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
   * Convert a database row into a BooksingModel instance.
   * @param {Object} row Database row.
   * @returns {BooksingModel} Mapped booking.
   */
  static tableToModel(row) {
    return new BooksingModel(
      Number(row.id),
      row.session_id,
      Number(row.user_id),
      row.created,
    );
  }

  /**
   * Retrieve all bookings.
   * @returns {Promise<Array<BooksingModel>>} Stored bookings.
   */
  static async getAll() {
    return this.query("SELECT * FROM bookings").then(
      (result) => result.map((row) => this.tableToModel(row.bookings)),
    );
  }

  /**
   * Retrieve a booking by its identifier.
   * @param {number} id Booking identifier.
   * @returns {Promise<BooksingModel>} Matching booking.
   * @throws {string} "not found" when no booking matches the identifier.
   */
  static async getById(id) {
    const result = await this.query("SELECT * FROM bookings WHERE id = ?", [id]);
    return result.length > 0
      ? this.tableToModel(result[0].bookings)
      : Promise.reject("not found");
  }

  /**
   * Update an existing booking.
   * @param {BooksingModel} booking Booking to update.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static update(booking) {
    return this.query(
      `
            UPDATE bookings
            SET session_id = ?, user_id = ?, created = ?
            WHERE id = ?
        `,
      [booking.session_id, booking.user_id, booking.created, booking.id],
    );
  }

  /**
   * Create a booking with a generated identifier.
   * @param {BooksingModel} booking Booking to create.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static create(booking) {
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
   * @param {BooksingModel} booking Booking to create.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
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
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static delete(id) {
    return this.query("DELETE FROM bookings WHERE id = ?", [id]);
  }
}