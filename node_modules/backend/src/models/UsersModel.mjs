import { DatabaseModel } from "./DatabaseModel.mjs";

/**
 * Represents a user stored in the users table.
 */
export class UsersModel extends DatabaseModel {
  /**
   * @param {number|null} id User identifier.
   * @param {string} firstName User's first name.
   * @param {string} lastName User's last name.
   * @param {string|number} role User role.
   * @param {string} email User email address.
   * @param {string} password User password hash.
   * @param {string} phone User phone number.
   * @param {string|Date} dob User date of birth.
   * @param {number} deleted Soft-delete flag.
   * @param {string} authenticationKey User authentication key.
   */
  constructor(
    id,
    firstName,
    lastName,
    role,
    email,
    password,
    phone,
    dob,
    deleted,
    authenticationKey,
  ) {
    super();
    this.id = id;
    this.first_name = firstName;
    this.last_name = lastName;
    this.role = role;
    this.email = email;
    this.password = password;
    this.phone = phone;
    this.dob = dob;
    this.deleted = deleted;
    this.authentication_key = authenticationKey;
  }

  /**
   * Convert a database row into a UsersModel instance.
   * @param {Object} row Database row.
   * @returns {UsersModel} Mapped user.
   */
  static tableToModel(row) {
    return new UsersModel(
      Number(row.id),
      row.first_name,
      row.last_name,
      row.role,
      row.email,
      row.password,
      row.phone,
      row.dob,
      row.deleted,
      row.authentication_key,
    );
  }

  /**
   * Retrieve all non-deleted users.
   * @returns {Promise<Array<UsersModel>>} Active users.
   */
  static async getAll() {
    return this.query("SELECT * FROM users WHERE deleted = 0").then(
      (result) => result.map((row) => this.tableToModel(row.users)),
    );
  }

  /**
   * Search non-deleted users by name or email.
   * @param {string} term Search term.
   * @returns {Promise<Array<UsersModel>>} Matching users.
   */
  static async getBySearch(term) {
    return this.query(
      `
            SELECT * FROM users
            WHERE deleted = 0
            AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)
        `,
      [`%${term}%`, `%${term}%`, `%${term}%`],
    ).then((result) => result.map((row) => this.tableToModel(row.users)));
  }

  /**
   * Retrieve a user by identifier.
   * @param {number} id User identifier.
   * @returns {Promise<UsersModel>} Matching user.
   * @throws {string} "not found" when no user matches the identifier.
   */
  static async getById(id) {
    const result = await this.query("SELECT * FROM users WHERE id = ?", [id]);
    return result.length > 0
      ? this.tableToModel(result[0].users)
      : Promise.reject("not found");
  }

  /**
   * Update an existing user.
   * @param {UsersModel} user User to update.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static update(user) {
    return this.query(
      `
            UPDATE users
            SET first_name = ?, last_name = ?, role = ?, email = ?, password = ?,
                phone = ?, dob = ?, deleted = ?, authentication_key = ?
            WHERE id = ?
        `,
      [
        user.first_name,
        user.last_name,
        user.role,
        user.email,
        user.password,
        user.phone,
        user.dob,
        user.deleted,
        user.authentication_key,
        user.id,
      ],
    );
  }

  /**
   * Create a user with a generated identifier.
   * @param {UsersModel} user User to create.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static create(user) {
    return this.query(
      `
            INSERT INTO users
            (first_name, last_name, role, email, password, phone, dob, deleted, authentication_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        user.first_name,
        user.last_name,
        user.role,
        user.email,
        user.password,
        user.phone,
        user.dob,
        user.deleted,
        user.authentication_key,
      ],
    );
  }

  /**
   * Create a user with a caller-provided identifier.
   * @param {UsersModel} user User to create.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static createWithExistingID(user) {
    return this.query(
      `
            INSERT INTO users
            (id, first_name, last_name, role, email, password, phone, dob, deleted, authentication_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        user.id,
        user.first_name,
        user.last_name,
        user.role,
        user.email,
        user.password,
        user.phone,
        user.dob,
        user.deleted,
        user.authentication_key,
      ],
    );
  }

  /**
   * Delete a user by identifier.
   * @param {number} id User identifier.
   * @returns {Promise<import("mysql2/promise").OkPacket>} Database result.
   */
  static delete(id) {
    return this.query("DELETE FROM users WHERE id = ?", [id]);
  }
}