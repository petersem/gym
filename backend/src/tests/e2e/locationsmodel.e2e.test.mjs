import { afterAll, describe, expect, test } from '@jest/globals';
import { LocationModel } from '../../models/LocationModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';

let locationId;

afterAll(async () => {
  await LocationModel.connection.end();
});

describe('LocationModel end-to-end flow', () => {
  test('creates, reads, searches, updates, and deletes a location', async () => {
    const user = (await UsersModel.getAll())[0];
    const location = new LocationModel(null, `E2E Location ${Date.now()}`, '555-0186', `e2e-location-${Date.now()}@example.com`, '1 E2E Street', 'Brisbane', 4000, user.id, 0, user.id);

    try {
      locationId = (await LocationModel.create(location)).insertId;

      expect((await LocationModel.getById(locationId)).name).toBe(location.name);
      expect(await LocationModel.getBySearch(location.name)).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: locationId, name: location.name }),
      ]));

      location.id = locationId;
      location.suburb = 'Sydney';
      await LocationModel.update(location);
      expect((await LocationModel.getById(locationId)).suburb).toBe('Sydney');
    } finally {
      if (locationId) await LocationModel.delete(locationId);
    }

    await expect(LocationModel.getById(locationId)).rejects.toBe('not found');
  });
});
