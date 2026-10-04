import { afterEach, describe, expect, jest, test } from "@jest/globals";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import {
  connectWithRetry,
  initializationConfig,
  initializeDatabase,
} from "../../database/initializeDatabase.mjs";
import { ensureAdmin } from "../../database/ensureAdmin.mjs";

const env = {
  DB_HOST: "localhost",
  DB_PORT: "3306",
  DB_NAME: "gym_test",
  DB_USER: "gym_test_user",
  DB_PASSWORD: "test-app-password",
  DB_INIT_USER: "root",
  DB_INIT_PASSWORD: "test-init-password",
  DATA_SEED: "true",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: "test-admin-password",
};

afterEach(() => jest.restoreAllMocks());

function setup({
  state,
  existing = 0,
  admins = [{ id: 1 }],
  acquired = 1,
} = {}) {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed-password");
  const connection = {
    query: jest.fn(async (sql) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired }]];
      if (sql.startsWith("SELECT status")) return [state ? [state] : []];
      if (sql.startsWith("SELECT table_name"))
        return [Array(existing).fill({})];
      if (sql.startsWith("SELECT id FROM users")) return [admins];
      return [[], []];
    }),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    end: jest.fn(),
  };
  const appConnection = { query: jest.fn(), end: jest.fn() };
  const connect = jest
    .spyOn(mysql, "createConnection")
    .mockResolvedValueOnce(connection)
    .mockResolvedValueOnce(appConnection);
  return { connection, appConnection, connect };
}

describe("initialization configuration", () => {
  test.each([
    "DB_HOST",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "DB_INIT_PASSWORD",
  ])("requires %s", (key) => {
    expect(() => initializationConfig({ ...env, [key]: "" })).toThrow(key);
  });

  test.each([undefined, ""])(
    "uses DB_ROOT_PASSWORD when DB_INIT_PASSWORD is %j",
    (password) => {
      expect(
        initializationConfig({
          ...env,
          DB_INIT_PASSWORD: password,
          DB_ROOT_PASSWORD: "test-root-password",
        }).password,
      ).toBe("test-root-password");
    },
  );

  test("prefers an explicit initialization password over the root password", () => {
    expect(
      initializationConfig({ ...env, DB_ROOT_PASSWORD: "test-root-password" })
        .password,
    ).toBe(env.DB_INIT_PASSWORD);
  });

  test("uses the default port and privileged user", () => {
    expect(
      initializationConfig({
        ...env,
        DB_PORT: "",
        DB_INIT_USER: "",
        DATA_SEED: undefined,
      }),
    ).toMatchObject({ port: 3306, user: "root", multipleStatements: true });
  });

  test.each(["invalid-name", "a".repeat(65)])(
    "rejects database name %s",
    (name) => {
      expect(() => initializationConfig({ ...env, DB_NAME: name })).toThrow(
        "DB_NAME",
      );
    },
  );
  test.each(["no", "0", "65536", "1.5"])("rejects port %s", (port) => {
    expect(() => initializationConfig({ ...env, DB_PORT: port })).toThrow(
      "DB_PORT",
    );
  });
  test.each([
    ["root", "root"],
    ["bootstrap", "bootstrap"],
    ["root", "bootstrap"],
  ])("rejects runtime account %s with initializer %s", (user, init) => {
    expect(() =>
      initializationConfig({ ...env, DB_USER: user, DB_INIT_USER: init }),
    ).toThrow("separate");
  });
  test("rejects invalid seed flags", () => {
    expect(() => initializationConfig({ ...env, DATA_SEED: "yes" })).toThrow(
      "DATA_SEED",
    );
  });
});

describe("MySQL readiness", () => {
  test("retries transient failures", async () => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    const connection = {};
    const connect = jest
      .spyOn(mysql, "createConnection")
      .mockRejectedValueOnce(
        Object.assign(new Error("starting"), { code: "ECONNREFUSED" }),
      )
      .mockResolvedValueOnce(connection);
    expect(await connectWithRetry({}, 2, 0)).toBe(connection);
    expect(connect).toHaveBeenCalledTimes(2);
  });
  test.each(["ER_ACCESS_DENIED_ERROR", "ECONNREFUSED"])(
    "surfaces %s without retrying past the limit",
    async (code) => {
      const error = Object.assign(new Error("failed"), { code });
      jest.spyOn(mysql, "createConnection").mockRejectedValue(error);
      await expect(connectWithRetry({}, 1, 0)).rejects.toBe(error);
    },
  );
});

describe("database initialization", () => {
  test.each(["true", "false", undefined])(
    "initializes a new database with DATA_SEED=%s",
    async (flag) => {
      const { connection, appConnection, connect } = setup({ admins: [] });
      await initializeDatabase({ ...env, DATA_SEED: flag });
      expect(connection.query).toHaveBeenCalledWith(
        expect.stringContaining("CREATE DATABASE IF NOT EXISTS `gym_test`"),
      );
      expect(connection.query).toHaveBeenCalledWith(
        "CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?",
        [env.DB_USER, env.DB_PASSWORD],
      );
      expect(connection.query).toHaveBeenCalledWith(
        expect.stringContaining("GRANT SELECT, INSERT, UPDATE, DELETE"),
        [env.DB_USER],
      );
      const sql = connection.query.mock.calls.map(([query]) => query);
      expect(sql.some((query) => query.includes("INSERT INTO `users`"))).toBe(
        flag === "true",
      );
      expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(connection.commit).toHaveBeenCalledTimes(1);
      expect(connection.rollback).not.toHaveBeenCalled();
      expect(connect.mock.calls[1][0]).not.toHaveProperty("multipleStatements");
      expect(connect.mock.calls[1][0].password).toBe(env.DB_PASSWORD);
      expect(appConnection.query).toHaveBeenCalledWith("SELECT 1");
      expect(appConnection.end).toHaveBeenCalledTimes(1);
      expect(connection.end).toHaveBeenCalledTimes(1);
    },
  );

  test("adopts existing schemas without sample insertion", async () => {
    const { connection } = setup({ existing: 6 });
    await initializeDatabase(env);
    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO gym_initialization"),
      [false],
    );
    expect(
      connection.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO `users`"),
      ),
    ).toBe(false);
  });

  test.each([0, 1])(
    "resumes interrupted setup with saved seed choice %s",
    async (seed) => {
      const { connection } = setup({
        state: { status: "initializing", sample_data: seed },
      });
      await initializeDatabase({ ...env, DATA_SEED: seed ? "false" : "true" });
      expect(
        connection.query.mock.calls.some(([sql]) =>
          sql.includes("INSERT INTO `users`"),
        ),
      ).toBe(Boolean(seed));
      expect(connection.commit).toHaveBeenCalled();
    },
  );

  test("does not recreate tables or reseed completed databases", async () => {
    const { connection } = setup({
      state: { status: "complete", sample_data: 1 },
    });
    await initializeDatabase(env);
    expect(
      connection.query.mock.calls.some(([sql]) =>
        sql.includes("CREATE TABLE IF NOT EXISTS `users`"),
      ),
    ).toBe(false);
    expect(connection.beginTransaction).not.toHaveBeenCalled();
  });

  test.each([
    [{ acquired: 0 }, "lock"],
    [{ existing: 3 }, "incomplete"],
    [{ state: { status: "unknown", sample_data: 0 } }, "Unknown"],
  ])("rejects unsafe initialization state %p", async (options, message) => {
    const { connection } = setup(options);
    await expect(initializeDatabase(env)).rejects.toThrow(message);
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  test("rolls back sample data and the completion marker on failure", async () => {
    const { connection } = setup({ admins: [] });
    await expect(
      initializeDatabase({ ...env, ADMIN_EMAIL: "" }),
    ).rejects.toThrow("ADMIN_EMAIL");
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  test("closes both connections if app credentials cannot query", async () => {
    const { connection, appConnection } = setup();
    appConnection.query.mockRejectedValue(new Error("access denied"));
    await expect(initializeDatabase(env)).rejects.toThrow("access denied");
    expect(appConnection.end).toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalled();
  });
});

describe("admin seeding", () => {
  test.each(["ADMIN_EMAIL", "ADMIN_PASSWORD"])(
    "requires %s for a new admin",
    async (key) => {
      const { connection } = setup({ admins: [] });
      await expect(
        ensureAdmin(connection, { ...env, [key]: "" }),
      ).rejects.toThrow(key);
    },
  );
  test("does not log the initial password", async () => {
    const { connection } = setup({ admins: [] });
    await ensureAdmin(connection, env);
    expect(bcrypt.hash).toHaveBeenCalledWith(env.ADMIN_PASSWORD, 10);
    expect(JSON.stringify(console.log.mock.calls)).not.toContain(
      env.ADMIN_PASSWORD,
    );
  });
});
