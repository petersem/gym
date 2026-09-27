import { DatabaseModel } from "./DatabaseModel.mjs";

export class LocationModel extends DatabaseModel {
  //// Instance

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
    updatedBy
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
      row["updated_by"]
    );
  }


  /**
   *
   * @returns {Promise<Array<LocationModel>>}
   */
  static async getAll() {
    return await this.query("SELECT * FROM locations where deleted = 0").then(
      (result) => result.map((row) => this.tableToModel(row.locations)),
    );
  }

  /**
   *
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

  /** Columns that may be used to sort location listings. */
  static SORTABLE_COLUMNS = { name: "name", suburb: "suburb", postcode: "postcode" };

  /**
   * Search and sort non-deleted locations server-side.
   * @param {Object} [options] Search and sort options.
   * @param {string} [options.searchTerm] Optional search term for name/suburb/postcode.
   * @param {string} [options.sortBy] Column to sort by (name|suburb|postcode).
   * @param {string} [options.sortDir] Sort direction (asc|desc).
   * @returns {Promise<Array<LocationModel>>} Matching locations.
   */
  static async list({ searchTerm = "", sortBy = "name", sortDir = "asc" } = {}) {
    const column = this.SORTABLE_COLUMNS[sortBy] ?? this.SORTABLE_COLUMNS.name;
    const direction = sortDir === "desc" ? "DESC" : "ASC";
    const where = ["deleted = 0"];
    const values = [];
    if (searchTerm) {
      where.push("(name LIKE ? OR suburb LIKE ? OR postcode LIKE ?)");
      values.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    }
    return this.query(
      `SELECT * FROM locations WHERE ${where.join(" AND ")} ORDER BY ${column} ${direction}`,
      values,
    ).then((result) => result.map((row) => this.tableToModel(row.locations)));
  }

  /**
   *
   * @param {number} id
   * @returns {Promise<LocationModel>}
   */
  static async getById(id) {
    const result = await this.query("SELECT * FROM locations WHERE id = ?", [id]);
    return result.length > 0
      ? this.tableToModel(result[0].locations)
      : Promise.reject("not found");
  }

  /**
   *
   * @param {LocationModel} location
   * @returns {Promise<mysql.OkPacket>}
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
   *
   * @param {number} location id
   * @param {number} difference in stock level to apply
   * @returns {Promise<mysql.OkPacket>}
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
   * @param {LocationModel} location
   * @returns {Promise<mysql.OkPacket>}
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
   * @param {LocationModel} location
   * @returns {Promise<mysql.OkPacket>}
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
   * @param {number} id
   * @returns {Promise<mysql.OkPacket>}
   */
  static delete(id) {
    return this.query(`DELETE FROM locations WHERE id = ?`, [id]);
  }
}
