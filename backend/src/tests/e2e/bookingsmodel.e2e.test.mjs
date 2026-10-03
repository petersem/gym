import { afterAll, describe, expect, test } from "@jest/globals";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import { BookingsModel } from "../../models/BookingsModel.mjs";
import { LocationModel } from "../../models/LocationModel.mjs";
import { SessionsModel } from "../../models/SessionsModel.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

let userId;
let activityId;
let locationId;
let sessionId;
let bookingId;

// Model deletes are soft for users, activities and locations, so remove rows directly.
afterAll(async () => {
  await BookingsModel.query(
    "DELETE b FROM bookings b JOIN users u ON u.id = b.user_id WHERE u.id = ? OR u.email LIKE ?",
    [userId ?? 0, "e2e-booking-%"],
  );
  await SessionsModel.query(
    "DELETE s FROM sessions s JOIN activities a ON a.id = s.activity_id WHERE a.id = ? OR a.name LIKE ?",
    [activityId ?? 0, "E2E Booking Activity %"],
  );
  await LocationModel.query(
    "DELETE FROM locations WHERE id = ? OR name LIKE ?",
    [locationId ?? 0, "E2E Booking Location %"],
  );
  await ActivitiesModel.query(
    "DELETE FROM activities WHERE id = ? OR name LIKE ?",
    [activityId ?? 0, "E2E Booking Activity %"],
  );
  await UsersModel.query("DELETE FROM users WHERE id = ? OR email LIKE ?", [
    userId ?? 0,
    "e2e-booking-%",
  ]);
  await BookingsModel.connection.end();
});

// Exercises booking persistence against MySQL and removes dependent records afterward.
describe("BookingsModel end-to-end flow", () => {
  test("creates, reads, updates, and deletes a booking", async () => {
    const user = new UsersModel(
      null,
      "E2E",
      "Booking User",
      "member",
      `e2e-booking-${Date.now()}@example.com`,
      "hashed-password",
      "555-0184",
      "2000-01-01",
      0,
      "e2e-booking-key",
    );
    const owner = (await UsersModel.getAll())[0];
    const activity = new ActivitiesModel(
      null,
      `E2E Booking Activity ${Date.now()}`,
      "E2E description",
      0,
      owner.id,
    );
    const location = new LocationModel(
      null,
      `E2E Booking Location ${Date.now()}`,
      "555-0183",
      `e2e-b-${Date.now()}@example.com`,
      "3 E2E Street",
      "Brisbane",
      4002,
      owner.id,
      0,
      owner.id,
    );

    try {
      userId = (await UsersModel.create(user)).insertId;
      activityId = (await ActivitiesModel.create(activity)).insertId;
      locationId = (await LocationModel.create(location)).insertId;
      sessionId = (
        await SessionsModel.create(
          new SessionsModel(
            null,
            activityId,
            locationId,
            owner.id,
            "2026-10-02",
            "11:00:00",
          ),
        )
      ).insertId;
      bookingId = (
        await BookingsModel.create(
          new BookingsModel(null, sessionId, userId, "2026-09-26 10:00:00"),
        )
      ).insertId;

      expect((await BookingsModel.getById(bookingId)).user_id).toBe(userId);
      const booking = new BookingsModel(
        bookingId,
        sessionId,
        userId,
        "2026-09-26 11:00:00",
      );
      await BookingsModel.update(booking);
      expect((await BookingsModel.getById(bookingId)).created).toBe(
        "2026-09-26 10:00:00",
      );
    } finally {
      if (bookingId) {
        await BookingsModel.delete(bookingId);
      }
      if (sessionId) {
        await SessionsModel.delete(sessionId);
      }
      if (locationId) {
        await LocationModel.delete(locationId);
      }
      if (activityId) {
        await ActivitiesModel.delete(activityId);
      }
      if (userId) {
        await UsersModel.delete(userId);
      }
    }

    await expect(BookingsModel.getById(bookingId)).rejects.toBe("not found");
  });
});
