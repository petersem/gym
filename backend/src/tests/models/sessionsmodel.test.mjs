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
  test("constructs a session and maps a database row", () => {
    expect(session).toBeInstanceOf(SessionsModel);
    expect(SessionsModel.tableToModel(row)).toEqual(session);
  });

  test("getAll maps returned sessions", async () => {
    const query = jest
      .spyOn(SessionsModel, "query")
      .mockResolvedValue([
        { sessions: row },
        { sessions: { ...row, id: "124" } },
      ]);

    await expect(SessionsModel.getAll()).resolves.toEqual([
      session,
      new SessionsModel(124, 7, 2, 3, row.date, row.time, row.title),
    ]);
    expect(query).toHaveBeenCalledWith("SELECT * FROM sessions");
  });

  test("getById returns a session when found", async () => {
    const query = jest
      .spyOn(SessionsModel, "query")
      .mockResolvedValue([{ sessions: row }]);

    await expect(SessionsModel.getById(123)).resolves.toEqual(session);
    expect(query).toHaveBeenCalledWith(
      "SELECT * FROM sessions WHERE id = ?",
      [123],
    );
  });

  test("getById rejects when no session is found", async () => {
    jest.spyOn(SessionsModel, "query").mockResolvedValue([]);

    await expect(SessionsModel.getById(999)).rejects.toBe("not found");
  });

  test("update passes session fields in update order", async () => {
    const query = jest
      .spyOn(SessionsModel, "query")
      .mockResolvedValue({ affectedRows: 1 });

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
      .mockResolvedValue({ affectedRows: 1 });

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
