import { afterAll, describe, expect, test } from '@jest/globals';
import { ActivitiesModel } from '../../models/ActivitiesModel.mjs';
import { BookingsModel } from '../../models/BookingsModel.mjs';
import { LocationModel } from '../../models/LocationModel.mjs';
import { SessionsModel } from '../../models/SessionsModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';

const requestCount = 25;
const bookingIds = [];
const userIds = [];
let activityId;
let locationId;
let sessionId;

afterAll(async () => {
  await Promise.all(bookingIds.map((id) => BookingsModel.delete(id)));
  await BookingsModel.query("DELETE b FROM bookings b JOIN sessions s ON s.id = b.session_id JOIN activities a ON a.id = s.activity_id WHERE a.name LIKE ?", ["Load Booking Activity %"]);
  if (sessionId) await SessionsModel.delete(sessionId);
  await SessionsModel.query("DELETE s FROM sessions s JOIN activities a ON a.id = s.activity_id WHERE a.name LIKE ?", ["Load Booking Activity %"]);
  if (locationId) await LocationModel.delete(locationId);
  await LocationModel.query("DELETE FROM locations WHERE name LIKE ?", ["Load Booking Location %"]);
  if (activityId) await ActivitiesModel.delete(activityId);
  await ActivitiesModel.query("DELETE FROM activities WHERE name LIKE ?", ["Load Booking Activity %"]);
  await Promise.all(userIds.map((id) => UsersModel.delete(id)));
  await UsersModel.query("DELETE FROM users WHERE email LIKE ?", ["booking-load-%"]);
  await BookingsModel.connection.end();
});

describe('BookingsModel load test', () => {
  test(`handles ${requestCount} concurrent booking lifecycles`, async () => {
    const owner = (await UsersModel.getAll())[0];
    activityId = (await ActivitiesModel.create(new ActivitiesModel(null, `Load Booking Activity ${Date.now()}`, 'Load description', 0, owner.id))).insertId;
    locationId = (await LocationModel.create(new LocationModel(null, `Load Booking Location ${Date.now()}`, '555-0185', `bk-loc-${Date.now()}@example.com`, 'Load Street', 'Brisbane', 4002, owner.id, 0, owner.id))).insertId;
    sessionId = (await SessionsModel.create(new SessionsModel(null, activityId, locationId, owner.id, '2026-10-04', '13:00:00'))).insertId;

    const users = await Promise.all(Array.from({ length: requestCount }, (_, index) => UsersModel.create(
      new UsersModel(null, 'Load', `Booking User ${index}`, 'member', `booking-load-user-${Date.now()}-${index}@example.com`, 'hashed-password', '555-0186', '2000-01-01', 0, `booking-key-${index}`),
    )));
    userIds.push(...users.map(({ insertId }) => insertId));

    const created = await Promise.all(userIds.map((userId) => BookingsModel.create(
      new BookingsModel(null, sessionId, userId, '2026-09-26 10:00:00'),
    )));
    bookingIds.push(...created.map(({ insertId }) => insertId));

    const loaded = await Promise.all(bookingIds.map((id) => BookingsModel.getById(id)));
    expect(loaded).toHaveLength(requestCount);
    await Promise.all(loaded.map((booking) => BookingsModel.update({ ...booking, created: '2026-09-26 11:00:00' })));
    expect((await Promise.all(bookingIds.map((id) => BookingsModel.getById(id))))
      .every((booking) => booking.created === '2026-09-26 10:00:00')).toBe(true);

    await Promise.all(bookingIds.map((id) => BookingsModel.delete(id)));
    for (const id of bookingIds) await expect(BookingsModel.getById(id)).rejects.toBe('not found');
    bookingIds.length = 0;
    userIds.length = 0;
  });
});
