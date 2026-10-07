import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { SessionsModel } from "../../models/SessionsModel.mjs";

const row = {
  id: "123",
  activity_id: "7",
  location_id: "2",
  trainer_id: "3",
  date: "2026-09-23",
  time: "10:00:00",
  title: "Yoga with Trainer, Name",
};

const session = new SessionsModel(123, 7, 2, 3, row.date, row.time, row.title);

afterEach(() => {
  jest.restoreAllMocks();
});

// Query spies verify session mapping and SQL construction without contacting MySQL.
describe("SessionsModel unit tests", () => {
  test("getById rejects when no session is found", async () => {
    jest.spyOn(SessionsModel, "query").mockResolvedValue([]);

    await expect(SessionsModel.getById(999)).rejects.toBe("not found");
  });

  test("update passes session fields in update order", async () => {
    const query = jest
      .spyOn(SessionsModel, "query")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ affectedRows: 1 });

    await expect(SessionsModel.update(session)).resolves.toEqual({
      affectedRows: 1,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE sessions"),
      [
        session.title,
        session.activity_id,
        session.location_id,
        session.trainer_id,
        session.date,
        session.time,
        session.id,
      ],
    );
  });

  test("create passes all session fields", async () => {
    const query = jest
      .spyOn(SessionsModel, "query")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ affectedRows: 1 });

    await expect(SessionsModel.create(session)).resolves.toEqual({
      affectedRows: 1,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sessions"),
      [
        session.title,
        session.activity_id,
        session.location_id,
        session.trainer_id,
        session.date,
        session.time,
      ],
    );
  });

  test.each(["create", "update"])(
    "rejects trainer conflicts without a %s write",
    async (action) => {
      const query = jest
        .spyOn(SessionsModel, "query")
        .mockResolvedValue([{ id: 999 }]);
      await expect(SessionsModel[action](session)).resolves.toEqual({
        affectedRows: 0,
        trainerConflict: true,
      });
      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining("trainer_id = ? AND date = ? AND time = ?"),
        [
          3,
          row.date,
          row.time,
          action === "create" ? null : 123,
          action === "create" ? null : 123,
        ],
      );
      expect(query.mock.calls[0][0]).toContain("id <> ?");
    },
  );

  test.each(["create", "update"])(
    "propagates trainer lookup errors without a %s write",
    async (action) => {
      const query = jest
        .spyOn(SessionsModel, "query")
        .mockRejectedValue(new Error("Lookup failed"));
      await expect(SessionsModel[action](session)).rejects.toThrow(
        "Lookup failed",
      );
      expect(query).toHaveBeenCalledTimes(1);
    },
  );

  test("delete passes the session identifier", async () => {
    const query = jest
      .spyOn(SessionsModel, "query")
      .mockResolvedValue({ affectedRows: 1 });

    await expect(SessionsModel.delete(123)).resolves.toEqual({
      affectedRows: 1,
    });
    expect(query).toHaveBeenCalledWith(
      "DELETE FROM sessions WHERE id = ?",
      [123],
    );
  });
});
