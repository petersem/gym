import mysql from "mysql2/promise";

export class DatabaseModel {
  static connection;

    static {
        this.connection = mysql.createPool({
            host: "localhost",
            user: "gymuser",
            port: 3307,
            password: "Testing123!",
            database: "gym",
            nestTables: true,
            dateStrings: true,
        })
    }

  static async query(sql, values) {
    const [result] = await this.connection.query(sql, values);
    return result;
  }
  //Note: How does the above destructuring assignment work?
  // query() => Promise<[firstFormat, secondFormat]>
  //query().then(([result]) => result) => Promise<firstFormat>

  //const items = ["Hello", "world", "!"]
  //const [first, second] = items

  static toMySqlDate(date) {
    const year = date.toLocaleString("default", { year: "numeric" });
    const month = date.toLocaleString("default", { month: "2-digit" });
    const day = date.toLocaleString("default", { day: "2-digit" });

    return [year, month, day].join("-");
  }
}
