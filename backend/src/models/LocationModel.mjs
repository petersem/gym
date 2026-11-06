import { DatabaseModel } from "./DatabaseModel.mjs";

/**
 * Represents a gym location stored in the locations table.
 */
export class LocationModel extends DatabaseModel {
  //// Instance

  /**
   * @param {number|null} id Location identifier.
   * @param {string} name Location name.
   * @param {string} phone Contact phone number.
   * @param {string} email Contact email address.
   * @param {string} street Street address.
   * @param {string} suburb Suburb name.
   * @param {string|number} postcode Postal code.
   * @param {number|null} manager ID of the location manager.
   * @param {number} deleted Soft-delete flag.
   * @param {number} updatedBy ID of the user who last updated the location.
   */
  constructor(
    id,
    name,
    phone,
    email,
    street,
    suburb,
    postcode,
    manager,
    deleted,
    updatedBy,
  ) {
    super();
    this.id = id;
    this.name = name;
    this.phone = phone;
    this.email = email;
    this.street = street;
    this.suburb = suburb;
    this.postcode = postcode;
    this.manager = manager;
    this.deleted = deleted;
    this.updated_by = updatedBy;
  }

  //// Static

  /**
   * Convert a database row into a LocationModel instance.
   * @param {Object} row Database row.
   * @returns {LocationModel} Mapped location.
   */
  static tableToModel(row) {
    return new LocationModel(
      Number(row["id"]),
      row["name"],
      row["phone"],
      row["email"],
      row["street"],
      row["suburb"],
      row["postcode"],
      row["manager"],
      row["deleted"],
      row["updated_by"],
    );
  }

  /**
   * Retrieve all locations that are not soft-deleted.
   * @returns {Promise<Array<LocationModel>>}
   */
  static async getAll() {
    return await this.query("SELECT * FROM locations where deleted = 0").then(
      (result) => result.map((row) => this.tableToModel(row.locations)),
    );
  }

  /**
   * Find non-deleted locations whose name, suburb, or postcode contains the search term.
   * @param {string} term Text used to search location names, suburbs, and postcodes.
   * @returns {Promise<Array<LocationModel>>}
   */
  static async getBySearch(term) {
    return this.query(
      `
            SELECT * FROM locations 
            WHERE deleted = 0 
            AND (name LIKE ? OR suburb LIKE ? OR postcode LIKE ?)
        `,
      [`%${term}%`, `%${term}%`, `%${term}%`],
    ).then((result) => result.map((row) => this.tableToModel(row.locations)));
  }

  // Columns that may be used to sort location listings.
  static SORTABLE_COLUMNS = {
    name: "name",
    suburb: "suburb",
    postcode: "postcode",
  };

  /**
   * Search and sort non-deleted locations server-side.
   * @param {Object} [options] Search and sort options.
   * @param {string} [options.searchTerm] Optional search term for name/suburb/postcode.
   * @param {string} [options.sortBy] Column to sort by (name|suburb|postcode).
   * @param {string} [options.sortDir] Sort direction (asc|desc).
   * @param {number} [options.page] 1-indexed page number for pagination.
   * @param {number} [options.pageSize] Number of rows per page.
   * @returns {Promise<{ locations: Array<LocationModel>, total: number }>} Matching locations and total match count.
   */
  static async list({
    searchTerm = "",
    sortBy = "name",
    sortDir = "asc",
    page = 1,
    pageSize = null,
  } = {}) {
    const column = this.SORTABLE_COLUMNS[sortBy] ?? this.SORTABLE_COLUMNS.name;
    const direction = sortDir === "desc" ? "DESC" : "ASC";
    const where = ["deleted = 0"];
    const values = [];
    if (searchTerm) {
      where.push("(name LIKE ? OR suburb LIKE ? OR postcode LIKE ?)");
      values.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }
    const whereClause = where.join(" AND ");
    const countResult = await this.query(
      `SELECT COUNT(*) AS total FROM locations WHERE ${whereClause}`,
      values,
    );
    const total = Number(countResult[0]?.[""]?.total ?? 0);
    const limitClause = pageSize ? "LIMIT ? OFFSET ?" : "";
    const limitValues = pageSize
      ? [pageSize, (Math.max(1, page) - 1) * pageSize]
      : [];
    const locations = await this.query(
      `SELECT * FROM locations WHERE ${whereClause} ORDER BY ${column} ${direction} ${limitClause}`,
      [...values, ...limitValues],
    ).then((result) => result.map((row) => this.tableToModel(row.locations)));
    return { locations, total };
  }

  /**
   * Retrieve a location by its identifier.
   * @param {number} id Unique location identifier.
   * @returns {Promise<LocationModel>} The matching location.
   * @throws {"not found"} When no location has the supplied identifier.
   */
  static async getById(id) {
    const result = await this.query("SELECT * FROM locations WHERE id = ?", [
      id,
    ]);
    return result.length > 0
      ? this.tableToModel(result[0].locations)
      : Promise.reject("not found");
  }

  /**
   * Update the stored fields of an existing location.
   * @param {LocationModel} location Location values to persist; its `id` selects the row.
   * @returns {Promise<mysql.OkPacket>} Database result describing the update.
   */
  static update(location) {
    return this.query(
      `
            UPDATE locations
            SET name = ?, phone = ?, email = ?, street = ?, suburb = ?, postcode = ?, manager = ?, deleted = ?, updated_by = ?
            WHERE id = ?
        `,
      [
        location.name,
        location.phone,
        location.email,
        location.street,
        location.suburb,
        location.postcode,
        location.manager,
        location.deleted,
        location.updated_by,
        location.id,
      ],
    );
  }

  /**
   * Adjust a location's stock value by the supplied difference.
   * @param {number} id Unique location identifier.
   * @param {number} difference Stock adjustment to apply; may be positive or negative.
   * @returns {Promise<mysql.OkPacket>} Database result describing the update.
   */
  static updateLocationById(id, difference) {
    return this.query(
      `
            UPDATE locations
            SET stock = stock + ?
            WHERE id = ?
        `,
      [difference, id],
    );
  }

  /**
   * Insert a new location using a database-generated identifier.
   * @param {LocationModel} location Location values to insert.
   * @returns {Promise<mysql.OkPacket>} Database result describing the insert.
   */
  static create(location) {
    return this.query(
      `
            INSERT INTO locations
            (name, phone, email, street, suburb, postcode, manager, deleted, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        location.name,
        location.phone,
        location.email,
        location.street,
        location.suburb,
        location.postcode,
        location.manager,
        location.deleted,
        location.updated_by,
      ],
    );
  }

  /**
   * Insert a location while preserving the identifier supplied on the model.
   * @param {LocationModel} location Location values, including the identifier to insert.
   * @returns {Promise<mysql.OkPacket>} Database result describing the insert.
   */
  static createWithExistingID(location) {
    return this.query(
      `
            INSERT INTO locations
            (id, name, phone, email, street, suburb, postcode, manager, deleted, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        location.id,
        location.name,
        location.phone,
        location.email,
        location.street,
        location.suburb,
        location.postcode,
        location.manager,
        location.deleted,
        location.updated_by,
      ],
    );
  }

  /**
   * Soft-delete the location with the supplied identifier.
   * @param {number} id Unique location identifier.
   * @returns {Promise<mysql.OkPacket>} Database result describing the update.
   */
  static delete(id) {
    return this.query(`UPDATE locations SET deleted = 1 WHERE id = ?`, [id]);
  }
}
