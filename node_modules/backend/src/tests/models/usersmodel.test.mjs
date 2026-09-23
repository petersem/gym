import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { UsersModel } from '../../models/UsersModel.mjs';

const row = {
  id: '7',
  first_name: 'Ada',
  last_name: 'Lovelace',
  role: 'member',
  email: 'ada@example.com',
  password: 'hashed-password',
  phone: '555-0100',
  dob: '1815-12-10',
  deleted: 0,
  authentication_key: 'auth-key',
};

const user = new UsersModel(
  7,
  row.first_name,
  row.last_name,
  row.role,
  row.email,
  row.password,
  row.phone,
  row.dob,
  row.deleted,
  row.authentication_key,
);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('UsersModel unit tests', () => {
  test('constructs a user and maps a database row', () => {
    expect(user).toBeInstanceOf(UsersModel);
    expect(UsersModel.tableToModel(row)).toEqual(user);
  });

  test('getAll maps returned users', async () => {
    const query = jest.spyOn(UsersModel, 'query').mockResolvedValue([
      { users: row },
      { users: { ...row, id: '8', email: 'grace@example.com' } },
    ]);

    await expect(UsersModel.getAll()).resolves.toEqual([
      user,
      new UsersModel(8, row.first_name, row.last_name, row.role, 'grace@example.com', row.password, row.phone, row.dob, row.deleted, row.authentication_key),
    ]);
    expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE deleted = 0');
  });

  test('getBySearch uses the term for names and email', async () => {
    const query = jest.spyOn(UsersModel, 'query').mockResolvedValue([{ users: row }]);

    await expect(UsersModel.getBySearch('Ada')).resolves.toEqual([user]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('first_name LIKE ? OR last_name LIKE ? OR email LIKE ?'),
      ['%Ada%', '%Ada%', '%Ada%'],
    );
  });

  test('getById returns a user when found', async () => {
    const query = jest.spyOn(UsersModel, 'query').mockResolvedValue([{ users: row }]);

    await expect(UsersModel.getById(7)).resolves.toEqual(user);
    expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [7]);
  });

  test('getById rejects when no user is found', async () => {
    jest.spyOn(UsersModel, 'query').mockResolvedValue([]);

    await expect(UsersModel.getById(999)).rejects.toBe('not found');
  });

  test('update passes user fields in update order', async () => {
    const query = jest.spyOn(UsersModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(UsersModel.update(user)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      [user.first_name, user.last_name, user.role, user.email, user.password, user.phone, user.dob, user.deleted, user.authentication_key, user.id],
    );
  });

  test('create passes user fields without an id', async () => {
    const query = jest.spyOn(UsersModel, 'query').mockResolvedValue({ insertId: 7 });

    await expect(UsersModel.create(user)).resolves.toEqual({ insertId: 7 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      [user.first_name, user.last_name, user.role, user.email, user.password, user.phone, user.dob, user.deleted, user.authentication_key],
    );
  });

  test('createWithExistingID includes the user id', async () => {
    const query = jest.spyOn(UsersModel, 'query').mockResolvedValue({ insertId: 7 });

    await expect(UsersModel.createWithExistingID(user)).resolves.toEqual({ insertId: 7 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      [user.id, user.first_name, user.last_name, user.role, user.email, user.password, user.phone, user.dob, user.deleted, user.authentication_key],
    );
  });

  test('delete passes the user id', async () => {
    const query = jest.spyOn(UsersModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(UsersModel.delete(7)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith('DELETE FROM users WHERE id = ?', [7]);
  });
});