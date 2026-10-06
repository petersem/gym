import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import mysql from "mysql2/promise";
import { ensureAdmin } from "./ensureAdmin.mjs";
import { logInfo, logWarning } from "../utilities/logger.mjs";

const tables = [
  "users",
  "activities",
  "blog",
  "locations",
  "sessions",
  "bookings",
];
const retryableErrors = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "PROTOCOL_CONNECTION_LOST",
  "ER_SERVER_SHUTDOWN",
]);

export function initializationConfig(env) {
  for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
    if (!env[key])
      throw new Error(`${key} is required for database initialization.`);
  }
  const initPassword = env.DB_INIT_PASSWORD || env.DB_ROOT_PASSWORD;
  if (!initPassword) {
    throw new Error(
      "DB_INIT_PASSWORD or DB_ROOT_PASSWORD is required for database initialization.",
    );
  }
  if (!/^[A-Za-z0-9_]{1,64}$/.test(env.DB_NAME)) {
    throw new Error(
      "DB_NAME must contain 1-64 letters, digits or underscores.",
    );
  }
  const port = Number(env.DB_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be an integer between 1 and 65535.");
  }
  const initUser = env.DB_INIT_USER || "root";
  if (env.DB_USER === initUser || env.DB_USER === "root") {
    throw new Error(
      "DB_USER must be separate from the privileged initialization account.",
    );
  }
  if (env.DATA_SEED && !["true", "false"].includes(env.DATA_SEED)) {
    throw new Error("DATA_SEED must be true or false.");
  }
  return {
    host: env.DB_HOST,
    port,
    user: initUser,
    password: initPassword,
    multipleStatements: true,
    connectTimeout: 5000,
  };
}

export async function connectWithRetry(options, attempts = 30, delay = 2000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await mysql.createConnection(options);
    } catch (error) {
      if (!retryableErrors.has(error.code) || attempt === attempts) throw error;
      console.log(logInfo, `Waiting for MySQL (${attempt}/${attempts})...`);
      await setTimeout(delay);
    }
  }
}

export async function initializeDatabase(env) {
  const options = initializationConfig(env);
  const connection = await connectWithRetry(options);
  try {
    const lock = `gym-init:${createHash("sha256").update(env.DB_NAME).digest("hex").slice(0, 48)}`;
    const [[{ acquired }]] = await connection.query(
      "SELECT GET_LOCK(?, 60) AS acquired",
      [lock],
    );
    if (Number(acquired) !== 1) {
      throw new Error("Could not acquire the database initialization lock.");
    }
    const database = mysql.escapeId(env.DB_NAME);
    const [existingDatabases] = await connection.query(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [env.DB_NAME],
    );
    const databaseExists = existingDatabases.length > 0;
    if (databaseExists) {
      console.log(
        logWarning,
        `Database ${database} already exists. It will not be recreated.`,
      );
    } else {
      console.log(logInfo, `Creating database ${database}...`);
    }

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
    if (!databaseExists) console.log(logInfo, `Database ${database} created.`);
    const account = `${mysql.escape(env.DB_USER)}@'%'`;
    console.log(logInfo, `Creating MySQL app account ${account} if absent...`);
    await connection.query("CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?", [
      env.DB_USER,
      env.DB_PASSWORD,
    ]);
    console.log(logInfo, `MySQL app account ${account} is available.`);
    await connection.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${database}.* TO ?@'%'`,
      [env.DB_USER],
    );
    console.log(logInfo, `Granted privileges on ${database} to ${account}.`);
    await connection.query(`USE ${database}`);
    await connection.query(
      `CREATE TABLE IF NOT EXISTS gym_initialization (
        id TINYINT NOT NULL PRIMARY KEY,
        status VARCHAR(20) NOT NULL,
        sample_data BOOLEAN NOT NULL
      ) ENGINE=InnoDB`,
    );
    const [[state]] = await connection.query(
      "SELECT status, sample_data FROM gym_initialization WHERE id = 1",
    );
    if (state && !["initializing", "complete"].includes(state.status)) {
      throw new Error("Unknown database initialization status.");
    }
    let seed = state ? Boolean(state.sample_data) : false;
    if (!state) {
      const [existing] = await connection.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN (?)",
        [env.DB_NAME, tables],
      );
      if (existing.length > 0 && existing.length !== tables.length) {
        throw new Error(
          "Existing database has an incomplete gym schema. Restore or repair it before starting.",
        );
      }
      seed = existing.length === 0 && env.DATA_SEED === "true";
      await connection.query(
        "INSERT INTO gym_initialization (id, status, sample_data) VALUES (1, 'initializing', ?)",
        [seed],
      );
    }
    if (!state || state.status === "initializing") {
      console.log(logInfo, "Initializing database schema...");
      await connection.query(
        readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
      );
      console.log("Applied database schema...");
      await connection.beginTransaction();
      try {
        if (seed) {
          await connection.query(
            readFileSync(new URL("./seed.sql", import.meta.url), "utf8"),
          );
        }
        await ensureAdmin(connection, env);
        await connection.query(
          "UPDATE gym_initialization SET status = 'complete' WHERE id = 1",
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
      console.log(
        logInfo,
        seed
          ? "Sample data seeded. All sample users have a password of 'testing123'"
          : "Sample data omitted.",
      );
    } else {
      await ensureAdmin(connection, env);
    }
    const appConnection = await mysql.createConnection({
      host: options.host,
      port: options.port,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });
    try {
      await appConnection.query("SELECT 1");
    } finally {
      await appConnection.end();
    }
    console.log(logInfo, "Database initialization complete.");
  } finally {
    // Closing this connection also releases its advisory lock.
    await connection.end();
  }
}
