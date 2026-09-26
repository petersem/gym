import { describe, expect, jest, test, afterEach } from '@jest/globals';
import { LocationModel } from '../../models/LocationModel.mjs';

const row = {
  id: '42',
  name: 'Central Gym',
  phone: '555-0100',
  email: 'central@example.com',
  street: '1 Main Street',
  city: 'Brisbane',
  postcode: '4000',
  manager: '7',
  deleted: 0,
  updated_by: 3,
};

const location = new LocationModel(
  42,
  row.name,
  row.phone,
  row.email,
  row.street,
  row.city,
  row.postcode,
  row.manager,
  row.deleted,
  row.updated_by,
);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LocationModel unit tests', () => {
  test('constructs a location and maps a database row', () => {
    expect(location).toBeInstanceOf(LocationModel);
    expect(LocationModel.tableToModel(row)).toEqual(location);
    expect(LocationModel.tableToModel(row).id).toBe(42);
  });

  test('getAll maps every returned row', async () => {
    const query = jest.spyOn(LocationModel, 'query').mockResolvedValue([
      { locations: row },
      { locations: { ...row, id: '43', name: 'West Gym' } },
    ]);

    await expect(LocationModel.getAll()).resolves.toEqual([
      location,
      new LocationModel(43, 'West Gym', row.phone, row.email, row.street, row.city, row.postcode, row.manager, row.deleted, row.updated_by),
    ]);
    expect(query).toHaveBeenCalledWith('SELECT * FROM locations where deleted = 0');
  });

  test('getBySearch uses the search term for location fields', async () => {
    const query = jest.spyOn(LocationModel, 'query').mockResolvedValue([{ locations: row }]);

    await expect(LocationModel.getBySearch('Central')).resolves.toEqual([location]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('name LIKE ? OR city LIKE ? OR postcode LIKE ?'),
      ['%Central%', '%Central%', '%Central%'],
    );
  });

  test('getById returns a mapped location when found', async () => {
    const query = jest.spyOn(LocationModel, 'query').mockResolvedValue([{ locations: row }]);

    await expect(LocationModel.getById(42)).resolves.toEqual(location);
    expect(query).toHaveBeenCalledWith('SELECT * FROM locations WHERE id = ?', [42]);
  });

  test('getById rejects when no location is found', async () => {
    jest.spyOn(LocationModel, 'query').mockResolvedValue([]);

    await expect(LocationModel.getById(999)).rejects.toBe('not found');
  });

  test('update passes all location fields in update order', async () => {
    const query = jest.spyOn(LocationModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(LocationModel.update(location)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE locations'),
      [location.name, location.phone, location.email, location.street, location.city, location.postcode, location.manager, location.deleted, location.updated_by, location.id],
    );
  });

  test('updateLocationById passes the stock difference and id', async () => {
    const query = jest.spyOn(LocationModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(LocationModel.updateLocationById(42, -2)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('SET stock = stock + ?'), [-2, 42]);
  });

  test('create passes location fields without an id', async () => {
    const query = jest.spyOn(LocationModel, 'query').mockResolvedValue({ insertId: 42 });

    await expect(LocationModel.create(location)).resolves.toEqual({ insertId: 42 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO locations'),
      [location.name, location.phone, location.email, location.street, location.city, location.postcode, location.manager, location.deleted, location.updated_by],
    );
  });

  test('createWithExistingID includes the location id', async () => {
    const query = jest.spyOn(LocationModel, 'query').mockResolvedValue({ insertId: 42 });

    await expect(LocationModel.createWithExistingID(location)).resolves.toEqual({ insertId: 42 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO locations'),
      [location.id, location.name, location.phone, location.email, location.street, location.city, location.postcode, location.manager, location.deleted, location.updated_by],
    );
  });

  test('delete passes the location id', async () => {
    const query = jest.spyOn(LocationModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(LocationModel.delete(42)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith('DELETE FROM locations WHERE id = ?', [42]);
  });
});