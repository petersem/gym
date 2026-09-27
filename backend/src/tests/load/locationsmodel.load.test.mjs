import { afterAll, describe, expect, test } from '@jest/globals';
import { LocationModel } from '../../models/LocationModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';

const requestCount = 25;
const createdIds = [];

afterAll(async () => {
  await Promise.all(createdIds.map((id) => LocationModel.delete(id)));
  await LocationModel.query("DELETE FROM locations WHERE name LIKE ?", ["Load Location %"]);
  await LocationModel.connection.end();
});

describe('LocationModel load test', () => {
  test(`handles ${requestCount} concurrent location lifecycles`, async () => {
    const owner = (await UsersModel.getAll())[0];
    const created = await Promise.all(Array.from({ length: requestCount }, (_, index) => LocationModel.create(
      new LocationModel(null, `Load Location ${Date.now()}-${index}`, '555-0183', `load-loc-${Date.now()}-${index}@example.com`, 'Load Street', 'Brisbane', 4000, owner.id, 0, owner.id),
    )));
    createdIds.push(...created.map(({ insertId }) => insertId));

    const loaded = await Promise.all(createdIds.map((id) => LocationModel.getById(id)));
    expect(loaded).toHaveLength(requestCount);
    await Promise.all(loaded.map((location) => LocationModel.update({ ...location, city: 'Sydney' })));
    expect((await Promise.all(createdIds.map((id) => LocationModel.getById(id))))
      .every((location) => location.city === 'Sydney')).toBe(true);

    await Promise.all(createdIds.map((id) => LocationModel.delete(id)));
    for (const id of createdIds) await expect(LocationModel.getById(id)).rejects.toBe('not found');
    createdIds.length = 0;
  });
});
