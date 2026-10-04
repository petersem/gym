import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { DatabaseModel } from "../../models/DatabaseModel.mjs";

const originalConnection = DatabaseModel.connection;

afterEach(() => {
  DatabaseModel.connection = originalConnection;
});

// Stubs the pool query method to test database helpers without a live connection.
describe("DatabaseModel unit tests", () => {
  test.each([false, true])(
    "configures the pool with explicit environment values: %s",
    async (configured) => {
      const values = {
        DB_HOST: "database.example",
        DB_USER: "test-user",
        DB_PORT: "3309",
        DB_PASSWORD: "test-password",
        DB_NAME: "test_database",
      };
      const original = Object.fromEntries(
        Object.keys(values).map((key) => [key, process.env[key]]),
      );
      try {
        for (const [key, value] of Object.entries(values)) {
          if (configured) process.env[key] = value;
          else delete process.env[key];
        }
        await jest.isolateModulesAsync(async () => {
          const { DatabaseModel: isolated } =
            await import("../../models/DatabaseModel.mjs");
          try {
            expect(
              isolated.connection.pool.config.connectionConfig,
            ).toMatchObject({
              host: configured ? values.DB_HOST : "127.0.0.1",
              user: configured ? values.DB_USER : "gymuser",
              port: configured ? 3309 : 3307,
              password: configured ? values.DB_PASSWORD : "Testing123!",
              database: configured ? values.DB_NAME : "gym",
              nestTables: true,
              dateStrings: true,
            });
          } finally {
            await isolated.connection.end();
          }
        });
      } finally {
        for (const [key, value] of Object.entries(original)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    },
  );

  test("query returns the first value from the database response", async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([["row"], ["field"]]),
    };
    DatabaseModel.connection = connection;

    await expect(DatabaseModel.query("SELECT ?", ["value"])).resolves.toEqual([
      "row",
    ]);
    expect(connection.query).toHaveBeenCalledWith("SELECT ?", ["value"]);
  });

  test("toMySqlDate formats the date components as YYYY-MM-DD", () => {
    const date = {
      toLocaleString: jest
        .fn()
        .mockReturnValueOnce("2026")
        .mockReturnValueOnce("09")
        .mockReturnValueOnce("23"),
    };

    expect(DatabaseModel.toMySqlDate(date)).toBe("2026-09-23");
    expect(date.toLocaleString).toHaveBeenNthCalledWith(1, "default", {
      year: "numeric",
    });
    expect(date.toLocaleString).toHaveBeenNthCalledWith(2, "default", {
      month: "2-digit",
    });
    expect(date.toLocaleString).toHaveBeenNthCalledWith(3, "default", {
      day: "2-digit",
    });
  });
});
