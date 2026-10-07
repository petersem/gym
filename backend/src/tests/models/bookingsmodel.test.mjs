import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { BookingsModel } from "../../models/BookingsModel.mjs";

const row = {
  id: "21",
  session_id: "session-123",
  user_id: "7",
  created: "2026-09-23 10:00:00",
};

const booking = new BookingsModel(21, row.session_id, 7, row.created);

afterEach(() => {
  jest.restoreAllMocks();
});

// Query spies verify booking mapping and SQL construction without contacting MySQL.
describe("BookingsModel unit tests", () => {
  test("constructs a booking and maps a database row", () => {
    expect(booking).toBeInstanceOf(BookingsModel);
    expect(BookingsModel.tableToModel(row)).toEqual(booking);
  });

  test("getAll maps returned bookings", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValue([
        { bookings: row },
        { bookings: { ...row, id: "22" } },
      ]);

    await expect(BookingsModel.getAll()).resolves.toEqual([
      booking,
      new BookingsModel(22, row.session_id, 7, row.created),
    ]);
    expect(query).toHaveBeenCalledWith("SELECT * FROM bookings");
  });

  test("getByUserId returns only the requested user bookings", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValue([{ bookings: row }]);

    await expect(BookingsModel.getByUserId(7)).resolves.toEqual([booking]);
    expect(query).toHaveBeenCalledWith(
      "SELECT * FROM bookings WHERE user_id = ?",
      [7],
    );
  });

  test("getBySessionId returns only the requested session bookings", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValue([{ bookings: row }]);

    await expect(BookingsModel.getBySessionId(row.session_id)).resolves.toEqual(
      [booking],
    );
    expect(query).toHaveBeenCalledWith(
      "SELECT * FROM bookings WHERE session_id = ?",
      [row.session_id],
    );
  });

  test("deleteBySessionId deletes all bookings for a session", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValue({ affectedRows: 2 });

    await expect(
      BookingsModel.deleteBySessionId(row.session_id),
    ).resolves.toEqual({ affectedRows: 2 });
    expect(query).toHaveBeenCalledWith(
      "DELETE FROM bookings WHERE session_id = ?",
      [row.session_id],
    );
  });

  test("getById returns a booking when found", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValue([{ bookings: row }]);

    await expect(BookingsModel.getById(21)).resolves.toEqual(booking);
    expect(query).toHaveBeenCalledWith(
      "SELECT * FROM bookings WHERE id = ?",
      [21],
    );
  });

  test("getById rejects when no booking is found", async () => {
    jest.spyOn(BookingsModel, "query").mockResolvedValue([]);

    await expect(BookingsModel.getById(999)).rejects.toBe("not found");
  });

  test("update passes booking fields in update order", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ affectedRows: 1 });

    await expect(BookingsModel.update(booking)).resolves.toEqual({
      affectedRows: 1,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE bookings"),
      [booking.session_id, booking.user_id, booking.id],
    );
  });

  test("create passes booking fields without an id", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ insertId: 21 });

    await expect(BookingsModel.create(booking)).resolves.toEqual({
      insertId: 21,
    });
    expect(query).toHaveBeenNthCalledWith(
      1,
      "SELECT id FROM bookings WHERE session_id = ? AND user_id = ? LIMIT 1",
      [booking.session_id, booking.user_id],
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO bookings"),
      [booking.session_id, booking.user_id, booking.created],
    );
  });

  test("does not insert a duplicate session and user booking", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValue([{ bookings: { id: 21 } }]);

    await expect(BookingsModel.create(booking)).resolves.toEqual({
      affectedRows: 0,
      duplicate: true,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test.each([null, 21])("checks the user's session date and time, excluding edited booking %s", async (id) => {
    const query = jest.spyOn(BookingsModel, "query").mockResolvedValue([{ id: 99 }]);
    await expect(BookingsModel.hasStartTimeConflict({ ...booking, id })).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("booked.date = target.date"),
      [booking.session_id, booking.user_id, id, id],
    );
    const sql = query.mock.calls[0][0];
    expect(sql).toContain("booked.time = target.time");
    expect(sql).toContain("b.user_id = ?");
    expect(sql).toContain("b.id <> ?");
    query.mockResolvedValue([]);
    await expect(BookingsModel.hasStartTimeConflict({ ...booking, id })).resolves.toBe(false);
  });

  test.each(["create", "update"])("does not %s a booking with a start-time conflict", async (action) => {
    const query = jest.spyOn(BookingsModel, "query");
    if (action === "create") query.mockResolvedValueOnce([]);
    query.mockResolvedValueOnce([{ id: 99 }]);
    await expect(BookingsModel[action](booking)).resolves.toEqual({
      affectedRows: 0, overlap: true,
    });
    expect(query.mock.calls.every(([sql]) => !/\b(?:INSERT|UPDATE)\b/.test(sql))).toBe(true);
  });

  test.each(["create", "update"])("propagates conflict-check failures without a %s write", async (action) => {
    const query = jest.spyOn(BookingsModel, "query");
    if (action === "create") query.mockResolvedValueOnce([]);
    query.mockRejectedValueOnce(new Error("Conflict check failed"));
    await expect(BookingsModel[action](booking)).rejects.toThrow("Conflict check failed");
    expect(query.mock.calls.every(([sql]) => !/\b(?:INSERT|UPDATE)\b/.test(sql))).toBe(true);
  });

  test("createWithExistingID includes the booking id", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValue({ insertId: 21 });

    await expect(BookingsModel.createWithExistingID(booking)).resolves.toEqual({
      insertId: 21,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO bookings"),
      [booking.id, booking.session_id, booking.user_id, booking.created],
    );
  });

  test("delete passes the booking id", async () => {
    const query = jest
      .spyOn(BookingsModel, "query")
      .mockResolvedValue({ affectedRows: 1 });

    await expect(BookingsModel.delete(21)).resolves.toEqual({
      affectedRows: 1,
    });
    expect(query).toHaveBeenCalledWith(
      "DELETE FROM bookings WHERE id = ?",
      [21],
    );
  });
});
