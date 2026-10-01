import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";

const row = {
  id: "12",
  name: "Yoga",
  description: "A guided yoga class",
  deleted: 0,
  updated_by: 3,
};

const activity = new ActivitiesModel(
  12,
  row.name,
  row.description,
  row.deleted,
  row.updated_by,
);

afterEach(() => {
  jest.restoreAllMocks();
});

// Query spies verify row mapping and SQL arguments without contacting MySQL.
describe("ActivitiesModel unit tests", () => {
  test("constructs an activity and maps a database row", () => {
    expect(activity).toBeInstanceOf(ActivitiesModel);
    expect(ActivitiesModel.tableToModel(row)).toEqual(activity);
  });

  test("getAll maps returned activities", async () => {
    const query = jest
      .spyOn(ActivitiesModel, "query")
      .mockResolvedValue([
        { activities: row },
        { activities: { ...row, id: "13", name: "Pilates" } },
      ]);

    await expect(ActivitiesModel.getAll()).resolves.toEqual([
      activity,
      new ActivitiesModel(
        13,
        "Pilates",
        row.description,
        row.deleted,
        row.updated_by,
      ),
    ]);
    expect(query).toHaveBeenCalledWith(
      "SELECT * FROM activities WHERE deleted = 0",
    );
  });

  test("getBySearch uses the term for name and description", async () => {
    const query = jest
      .spyOn(ActivitiesModel, "query")
      .mockResolvedValue([{ activities: row }]);

    await expect(ActivitiesModel.getBySearch("Yoga")).resolves.toEqual([
      activity,
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("name LIKE ? OR description LIKE ?"),
      ["%Yoga%", "%Yoga%"],
    );
  });

  test("list returns active activities with default sorting and no pagination", async () => {
    const query = jest
      .spyOn(ActivitiesModel, "query")
      .mockResolvedValueOnce([{ "": { total: "1" } }])
      .mockResolvedValueOnce([{ activities: row }]);

    await expect(ActivitiesModel.list()).resolves.toEqual({
      activities: [activity],
      total: 1,
    });
    expect(query).toHaveBeenNthCalledWith(
      1,
      "SELECT COUNT(*) AS total FROM activities WHERE deleted = 0",
      [],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      "SELECT * FROM activities WHERE deleted = 0 ORDER BY name ASC ",
      [],
    );
  });

  test("list searches, sorts, and paginates activities", async () => {
    const query = jest
      .spyOn(ActivitiesModel, "query")
      .mockResolvedValueOnce([{ "": { total: 4 } }])
      .mockResolvedValueOnce([{ activities: row }]);

    await expect(
      ActivitiesModel.list({
        searchTerm: "Yoga",
        sortBy: "description",
        sortDir: "desc",
        page: 3,
        pageSize: 2,
      }),
    ).resolves.toEqual({ activities: [activity], total: 4 });
    expect(query).toHaveBeenNthCalledWith(
      1,
      "SELECT COUNT(*) AS total FROM activities WHERE deleted = 0 AND (name LIKE ? OR description LIKE ?)",
      ["%Yoga%", "%Yoga%"],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      "SELECT * FROM activities WHERE deleted = 0 AND (name LIKE ? OR description LIKE ?) ORDER BY description DESC LIMIT ? OFFSET ?",
      ["%Yoga%", "%Yoga%", 2, 4],
    );
  });

  test.each([
    { countResult: [] },
    { countResult: [{}] },
    { countResult: [{ "": {} }] },
  ])(
    "list handles a missing count value and invalid options: $countResult",
    async ({ countResult }) => {
      const query = jest
        .spyOn(ActivitiesModel, "query")
        .mockResolvedValueOnce(countResult)
        .mockResolvedValueOnce([]);

      await expect(
        ActivitiesModel.list({
          sortBy: "invalid",
          sortDir: "invalid",
          page: 0,
          pageSize: 0,
        }),
      ).resolves.toEqual({ activities: [], total: 0 });
      expect(query).toHaveBeenNthCalledWith(
        2,
        "SELECT * FROM activities WHERE deleted = 0 ORDER BY name ASC ",
        [],
      );
    },
  );

  test("getById returns an activity when found", async () => {
    const query = jest
      .spyOn(ActivitiesModel, "query")
      .mockResolvedValue([{ activities: row }]);

    await expect(ActivitiesModel.getById(12)).resolves.toEqual(activity);
    expect(query).toHaveBeenCalledWith(
      "SELECT * FROM activities WHERE id = ?",
      [12],
    );
  });

  test("getById rejects when no activity is found", async () => {
    jest.spyOn(ActivitiesModel, "query").mockResolvedValue([]);

    await expect(ActivitiesModel.getById(999)).rejects.toBe("not found");
  });

  test("update passes activity fields in update order", async () => {
    const query = jest
      .spyOn(ActivitiesModel, "query")
      .mockResolvedValue({ affectedRows: 1 });

    await expect(ActivitiesModel.update(activity)).resolves.toEqual({
      affectedRows: 1,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE activities"),
      [
        activity.name,
        activity.description,
        activity.deleted,
        activity.updated_by,
        activity.id,
      ],
    );
  });

  test("create passes activity fields without an id", async () => {
    const query = jest
      .spyOn(ActivitiesModel, "query")
      .mockResolvedValue({ insertId: 12 });

    await expect(ActivitiesModel.create(activity)).resolves.toEqual({
      insertId: 12,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO activities"),
      [
        activity.name,
        activity.description,
        activity.deleted,
        activity.updated_by,
      ],
    );
  });

  test("createWithExistingID includes the activity id", async () => {
    const query = jest
      .spyOn(ActivitiesModel, "query")
      .mockResolvedValue({ insertId: 12 });

    await expect(
      ActivitiesModel.createWithExistingID(activity),
    ).resolves.toEqual({ insertId: 12 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO activities"),
      [
        activity.id,
        activity.name,
        activity.description,
        activity.deleted,
        activity.updated_by,
      ],
    );
  });

  test("soft deletes the activity id", async () => {
    const query = jest
      .spyOn(ActivitiesModel, "query")
      .mockResolvedValue({ affectedRows: 1 });

    await expect(ActivitiesModel.delete(12)).resolves.toEqual({
      affectedRows: 1,
    });
    expect(query).toHaveBeenCalledWith(
      "UPDATE activities SET deleted = 1 WHERE id = ?",
      [12],
    );
  });
});
