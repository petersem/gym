import mysql from "mysql2/promise";

/**
 * Provides a shared MySQL connection pool and database helpers for models.
 */
export class DatabaseModel {
  static connection;

  static {
    this.connection = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "gymuser",
      port: Number(process.env.DB_PORT) || 3307,
      password: process.env.DB_PASSWORD || "Testing123!",
      database: process.env.DB_NAME || "gym",
      nestTables: true,
      dateStrings: true,
    });
  }

  /**
   * Execute a SQL query using the shared connection pool.
   * @param {string} sql SQL statement with optional parameter placeholders.
   * @param {Array<*>} [values] Values bound to the SQL placeholders.
   * @returns {Promise<Array<Object>|Object>} Query rows or write result.
   */
  static async query(sql, values) {
    const [result] = await this.connection.query(sql, values);
    return result;
  }
  //Note: How does the above destructuring assignment work?
  // query() => Promise<[firstFormat, secondFormat]>
  //query().then(([result]) => result) => Promise<firstFormat>

  //const items = ["Hello", "world", "!"]
  //const [first, second] = items

  /**
   * Format a date as a MySQL date using its local calendar values.
   * @param {Date} date Date to format.
   * @returns {string} Date in YYYY-MM-DD format.
   */
  static toMySqlDate(date) {
    const year = date.toLocaleString("default", { year: "numeric" });
    const month = date.toLocaleString("default", { month: "2-digit" });
    const day = date.toLocaleString("default", { day: "2-digit" });

    return [year, month, day].join("-");
  }
}
