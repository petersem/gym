import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { DatabaseModel } from "../../models/DatabaseModel.mjs";

const originalConnection = DatabaseModel.connection;

afterEach(() => {
  DatabaseModel.connection = originalConnection;
});

// Stubs the pool query method to test database helpers without a live connection.
describe("DatabaseModel unit tests", () => {
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
