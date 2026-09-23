import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { BooksingModel } from '../../models/BooksingModel.mjs';

const row = {
  id: '21',
  session_id: 'session-123',
  user_id: '7',
  created: '2026-09-23 10:00:00',
};

const booking = new BooksingModel(
  21,
  row.session_id,
  7,
  row.created,
);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BooksingModel unit tests', () => {
  test('constructs a booking and maps a database row', () => {
    expect(booking).toBeInstanceOf(BooksingModel);
    expect(BooksingModel.tableToModel(row)).toEqual(booking);
  });

  test('getAll maps returned bookings', async () => {
    const query = jest.spyOn(BooksingModel, 'query').mockResolvedValue([
      { bookings: row },
      { bookings: { ...row, id: '22' } },
    ]);

    await expect(BooksingModel.getAll()).resolves.toEqual([
      booking,
      new BooksingModel(22, row.session_id, 7, row.created),
    ]);
    expect(query).toHaveBeenCalledWith('SELECT * FROM bookings');
  });

  test('getById returns a booking when found', async () => {
    const query = jest.spyOn(BooksingModel, 'query').mockResolvedValue([{ bookings: row }]);

    await expect(BooksingModel.getById(21)).resolves.toEqual(booking);
    expect(query).toHaveBeenCalledWith('SELECT * FROM bookings WHERE id = ?', [21]);
  });

  test('getById rejects when no booking is found', async () => {
    jest.spyOn(BooksingModel, 'query').mockResolvedValue([]);

    await expect(BooksingModel.getById(999)).rejects.toBe('not found');
  });

  test('update passes booking fields in update order', async () => {
    const query = jest.spyOn(BooksingModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(BooksingModel.update(booking)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE bookings'),
      [booking.session_id, booking.user_id, booking.created, booking.id],
    );
  });

  test('create passes booking fields without an id', async () => {
    const query = jest.spyOn(BooksingModel, 'query').mockResolvedValue({ insertId: 21 });

    await expect(BooksingModel.create(booking)).resolves.toEqual({ insertId: 21 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO bookings'),
      [booking.session_id, booking.user_id, booking.created],
    );
  });

  test('createWithExistingID includes the booking id', async () => {
    const query = jest.spyOn(BooksingModel, 'query').mockResolvedValue({ insertId: 21 });

    await expect(BooksingModel.createWithExistingID(booking)).resolves.toEqual({ insertId: 21 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO bookings'),
      [booking.id, booking.session_id, booking.user_id, booking.created],
    );
  });

  test('delete passes the booking id', async () => {
    const query = jest.spyOn(BooksingModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(BooksingModel.delete(21)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith('DELETE FROM bookings WHERE id = ?', [21]);
  });
});