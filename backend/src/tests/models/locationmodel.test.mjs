import { describe, expect, jest, test, afterEach } from "@jest/globals";
import { LocationModel } from "../../models/LocationModel.mjs";

const row = {
  id: "42",
  name: "Central Gym",
  phone: "555-0100",
  email: "central@example.com",
  street: "1 Main Street",
  suburb: "Brisbane",
  postcode: "4000",
  manager: "7",
  deleted: 0,
  updated_by: 3,
};

const location = new LocationModel(
  42,
  row.name,
  row.phone,
  row.email,
  row.street,
  row.suburb,
  row.postcode,
  row.manager,
  row.deleted,
  row.updated_by,
);

afterEach(() => {
  jest.restoreAllMocks();
});

// Query spies verify location mapping and SQL arguments without contacting MySQL.
describe("LocationModel unit tests", () => {
  test("list searches, sorts, and paginates locations", async () => {
    const query = jest
      .spyOn(LocationModel, "query")
      .mockResolvedValueOnce([{ "": { total: 4 } }])
      .mockResolvedValueOnce([{ locations: row }]);

    await expect(
      LocationModel.list({
        searchTerm: "Central",
        sortBy: "suburb",
        sortDir: "desc",
        page: 3,
        pageSize: 2,
      }),
    ).resolves.toEqual({ locations: [location], total: 4 });
    expect(query).toHaveBeenNthCalledWith(
      1,
      "SELECT COUNT(*) AS total FROM locations WHERE deleted = 0 AND (name LIKE ? OR suburb LIKE ? OR postcode LIKE ?)",
      ["%Central%", "%Central%", "%Central%"],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      "SELECT * FROM locations WHERE deleted = 0 AND (name LIKE ? OR suburb LIKE ? OR postcode LIKE ?) ORDER BY suburb DESC LIMIT ? OFFSET ?",
      ["%Central%", "%Central%", "%Central%", 2, 4],
    );
  });

  test("getById rejects when no location is found", async () => {
    jest.spyOn(LocationModel, "query").mockResolvedValue([]);

    await expect(LocationModel.getById(999)).rejects.toBe("not found");
  });

  test("update passes all location fields in update order", async () => {
    const query = jest
      .spyOn(LocationModel, "query")
      .mockResolvedValue({ affectedRows: 1 });

    await expect(LocationModel.update(location)).resolves.toEqual({
      affectedRows: 1,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE locations"),
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
  });

  test("create passes location fields without an id", async () => {
    const query = jest
      .spyOn(LocationModel, "query")
      .mockResolvedValue({ insertId: 42 });

    await expect(LocationModel.create(location)).resolves.toEqual({
      insertId: 42,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO locations"),
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
  });

  test("soft deletes the location id", async () => {
    const query = jest
      .spyOn(LocationModel, "query")
      .mockResolvedValue({ affectedRows: 1 });

    await expect(LocationModel.delete(42)).resolves.toEqual({
      affectedRows: 1,
    });
    expect(query).toHaveBeenCalledWith(
      "UPDATE locations SET deleted = 1 WHERE id = ?",
      [42],
    );
  });
});
