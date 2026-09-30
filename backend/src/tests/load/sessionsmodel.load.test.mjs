import { afterAll, describe, expect, test } from '@jest/globals';
import { ActivitiesModel } from '../../models/ActivitiesModel.mjs';
import { LocationModel } from '../../models/LocationModel.mjs';
import { SessionsModel } from '../../models/SessionsModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';

const requestCount = 25;
const sessionIds = [];
let activityId;
let locationId;

afterAll(async () => {
  await Promise.all(sessionIds.map((id) => SessionsModel.delete(id)));
  await SessionsModel.query("DELETE s FROM sessions s JOIN activities a ON a.id = s.activity_id WHERE a.name LIKE ?", ["Load Session Activity %"]);
  if (locationId) {await LocationModel.delete(locationId);}
  await LocationModel.query("DELETE FROM locations WHERE name LIKE ?", ["Load Session Location %"]);
  if (activityId) {await ActivitiesModel.delete(activityId);}
  await ActivitiesModel.query("DELETE FROM activities WHERE name LIKE ?", ["Load Session Activity %"]);
  await SessionsModel.connection.end();
});

describe('SessionsModel load test', () => {
  test(`handles ${requestCount} concurrent session lifecycles`, async () => {
    const owner = (await UsersModel.getAll())[0];
    activityId = (await ActivitiesModel.create(new ActivitiesModel(null, `Load Session Activity ${Date.now()}`, 'Load description', 0, owner.id))).insertId;
    locationId = (await LocationModel.create(new LocationModel(null, `Load Session Location ${Date.now()}`, '555-0184', `session-load-${Date.now()}@example.com`, 'Load Street', 'Brisbane', 4001, owner.id, 0, owner.id))).insertId;

    const created = await Promise.all(Array.from({ length: requestCount }, (_, index) => SessionsModel.create(
      new SessionsModel(null, activityId, locationId, owner.id, '2026-10-03', `09:${String(index).padStart(2, '0')}:00`),
    )));
    sessionIds.push(...created.map(({ insertId }) => insertId));

    const loaded = await Promise.all(sessionIds.map((id) => SessionsModel.getById(id)));
    expect(loaded).toHaveLength(requestCount);
    await Promise.all(loaded.map((session) => SessionsModel.update({ ...session, time: '12:00:00' })));
    expect((await Promise.all(sessionIds.map((id) => SessionsModel.getById(id))))
      .every((session) => session.time === '12:00:00')).toBe(true);

    await Promise.all(sessionIds.map((id) => SessionsModel.delete(id)));
    for (const id of sessionIds) {await expect(SessionsModel.getById(id)).rejects.toBe('not found');}
    sessionIds.length = 0;
  });
});
