import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { SessionsModel } from '../../models/SessionsModel.mjs';

const row = {
  sid: 'session-123',
  data: JSON.stringify({ userId: 7 }),
  lastAccess: '2026-09-23 10:00:00',
  expires: '2026-09-24 10:00:00',
};

const session = new SessionsModel(
  row.sid,
  row.data,
  row.lastAccess,
  row.expires,
);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SessionsModel unit tests', () => {
  test('constructs a session and maps a database row', () => {
    expect(session).toBeInstanceOf(SessionsModel);
    expect(SessionsModel.tableToModel(row)).toEqual(session);
  });

  test('getAll maps returned sessions', async () => {
    const query = jest.spyOn(SessionsModel, 'query').mockResolvedValue([
      { sessions: row },
      { sessions: { ...row, sid: 'session-456' } },
    ]);

    await expect(SessionsModel.getAll()).resolves.toEqual([
      session,
      new SessionsModel('session-456', row.data, row.lastAccess, row.expires),
    ]);
    expect(query).toHaveBeenCalledWith('SELECT * FROM sessions');
  });

  test('getById returns a session when found', async () => {
    const query = jest.spyOn(SessionsModel, 'query').mockResolvedValue([{ sessions: row }]);

    await expect(SessionsModel.getById(row.sid)).resolves.toEqual(session);
    expect(query).toHaveBeenCalledWith('SELECT * FROM sessions WHERE sid = ?', [row.sid]);
  });

  test('getById rejects when no session is found', async () => {
    jest.spyOn(SessionsModel, 'query').mockResolvedValue([]);

    await expect(SessionsModel.getById('missing')).rejects.toBe('not found');
  });

  test('update passes session fields in update order', async () => {
    const query = jest.spyOn(SessionsModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(SessionsModel.update(session)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sessions'),
      [session.data, session.lastAccess, session.expires, session.sid],
    );
  });

  test('create passes all session fields', async () => {
    const query = jest.spyOn(SessionsModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(SessionsModel.create(session)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sessions'),
      [session.sid, session.data, session.lastAccess, session.expires],
    );
  });

  test('delete passes the session identifier', async () => {
    const query = jest.spyOn(SessionsModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(SessionsModel.delete(row.sid)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith('DELETE FROM sessions WHERE sid = ?', [row.sid]);
  });
});