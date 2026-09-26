import { afterAll, describe, expect, test } from '@jest/globals';
import { ActivitiesModel } from '../../models/ActivitiesModel.mjs';
import { LocationModel } from '../../models/LocationModel.mjs';
import { SessionsModel } from '../../models/SessionsModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';

let activityId;
let locationId;
let sessionId;

const user = async () => (await UsersModel.getAll())[0];

afterAll(async () => {
  await SessionsModel.connection.end();
});

describe('SessionsModel end-to-end flow', () => {
  test('creates, reads, updates, and deletes a gym session', async () => {
    const owner = await user();
    const activity = new ActivitiesModel(null, `E2E Session Activity ${Date.now()}`, 'E2E description', 0, owner.id);
    const location = new LocationModel(null, `E2E Session Location ${Date.now()}`, '555-0185', `e2e-session-${Date.now()}@example.com`, '2 E2E Street', 'Brisbane', 4001, owner.id, 0, owner.id);

    try {
      activityId = (await ActivitiesModel.create(activity)).insertId;
      locationId = (await LocationModel.create(location)).insertId;
      const session = new SessionsModel(null, activityId, locationId, owner.id, '2026-10-01', '09:00:00');
      sessionId = (await SessionsModel.create(session)).insertId;

      expect((await SessionsModel.getById(sessionId)).activity_id).toBe(activityId);
      session.time = '10:00:00';
      session.id = sessionId;
      await SessionsModel.update(session);
      expect((await SessionsModel.getById(sessionId)).time).toBe('10:00:00');
    } finally {
      if (sessionId) await SessionsModel.delete(sessionId);
      if (locationId) await LocationModel.delete(locationId);
      if (activityId) await ActivitiesModel.delete(activityId);
    }

    await expect(SessionsModel.getById(sessionId)).rejects.toBe('not found');
  });
});
