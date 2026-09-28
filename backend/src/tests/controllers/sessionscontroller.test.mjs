import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { SessionsController } from '../../controllers/SessionsController.mjs';
import { SessionsModel } from '../../models/SessionsModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';
import { ActivitiesModel } from '../../models/ActivitiesModel.mjs';
import { LocationModel } from '../../models/LocationModel.mjs';
import { BookingsModel } from '../../models/BookingsModel.mjs';

const response = () => {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
    render: jest.fn(),
    redirect: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

const request = (params = {}, query = {}, body = {}) => ({ params, query, body });
const next = () => jest.fn();
const dateForOffset = (dayOffset) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

// Unmocked model calls open a real MySQL pool that keeps Jest from exiting.
beforeEach(() => {
  jest.spyOn(BookingsModel, 'getAll').mockResolvedValue([]);
  jest.spyOn(BookingsModel, 'getBySessionId').mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SessionsController', () => {
  test('renders session management and handles load errors', async () => {
    const sessions = [{ id: 1, title: 'Morning Yoga', location_id: 2, trainer_id: 3, date: dateForOffset(0) }];
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue(sessions);
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([]);
    const res = response();

    await SessionsController.viewSessionManagement(request({ sid: 'abc' }), res);
    expect(res.render).toHaveBeenCalledWith('session_management.ejs', expect.objectContaining({
      sessions: [expect.objectContaining(sessions[0])],
    }));

    await SessionsController.viewSessionManagement(request({ id: 'missing' }), res);
    expect(res.render).toHaveBeenCalledWith('session_management.ejs', expect.objectContaining({
      selectedSession: expect.objectContaining({ id: null }),
    }));

    await SessionsController.viewSessionManagement(request({}, { location_id: '2', trainer_id: '3' }), res);
    expect(res.render).toHaveBeenCalledWith('session_management.ejs', expect.objectContaining({
      sessions: [expect.objectContaining(sessions[0])],
    }));

    SessionsModel.getAll.mockRejectedValue(new Error('database error'));
    await SessionsController.viewSessionManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('filters sessions by name together with location and trainer', async () => {
    const sessions = [
      { id: 1, title: 'Morning Yoga', location_id: 2, trainer_id: 3, date: dateForOffset(0) },
      { id: 2, title: 'Evening Yoga', location_id: 2, trainer_id: 4, date: dateForOffset(0) },
      { id: 3, title: 'Morning Spin', location_id: 5, trainer_id: 3, date: dateForOffset(0) },
    ];
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue(sessions);
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([]);
    const res = response();

    await SessionsController.viewSessionManagement(request({}, {
      search_term: 'MORNING',
      location_id: '2',
      trainer_id: '3',
    }), res);

    const viewData = res.render.mock.calls[0][1];
    expect(viewData.sessions).toEqual([expect.objectContaining(sessions[0])]);
    expect(viewData.selectedSearchTerm).toBe('MORNING');
  });

  test('shows sessions from today through seven days ahead only', async () => {
    const sessions = [
      { id: 1, title: 'Today', date: dateForOffset(0) },
      { id: 2, title: 'Last included day', date: dateForOffset(7) },
      { id: 3, title: 'Outside range', date: dateForOffset(8) },
      { id: 4, title: 'Yesterday', date: dateForOffset(-1) },
    ];
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue(sessions);
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([]);
    const res = response();

    await SessionsController.viewSessionManagement(request(), res);

    expect(res.render.mock.calls[0][1].sessions).toEqual([
      expect.objectContaining(sessions[0]),
      expect.objectContaining(sessions[1]),
    ]);
  });

  test('includes the total booked users for each session', async () => {
    const sessions = [
      { id: 1, title: 'Morning Yoga', location_id: 2, trainer_id: 3, date: dateForOffset(0), time: '10:00:00' },
      { id: 2, title: 'Evening Yoga', location_id: 2, trainer_id: 3, date: dateForOffset(1), time: '18:00:00' },
    ];
    const bookings = [
      { id: 1, session_id: 1, user_id: 7 },
      { id: 2, session_id: 1, user_id: 8 },
      { id: 3, session_id: 2, user_id: 9 },
    ];
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue(sessions);
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(BookingsModel, 'getAll').mockResolvedValue(bookings);
    const res = response();

    await SessionsController.viewSessionManagement(request(), res);

    const renderedSessions = res.render.mock.calls[0][1].sessions;
    expect(renderedSessions).toEqual([
      expect.objectContaining({ id: 1, totalBookedUsers: 2 }),
      expect.objectContaining({ id: 2, totalBookedUsers: 1 }),
    ]);
  });

  test('sorts sessions by title, trainer, activity, location, date, and bookings', async () => {
    const sessions = [
      { id: 1, title: 'Zeta', activity_id: 5, location_id: 10, trainer_id: 3, date: dateForOffset(0), time: '10:00:00' },
      { id: 2, title: 'Alpha', activity_id: 6, location_id: 20, trainer_id: 4, date: dateForOffset(0), time: '11:00:00' },
      { id: 3, title: 'Middle', activity_id: 99, location_id: 99, trainer_id: 99, date: dateForOffset(1), time: '09:00:00' },
    ];
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue(sessions);
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([
      { id: 3, first_name: 'Zed', last_name: 'Zulu' },
      { id: 4, first_name: 'Ada', last_name: 'Able' },
    ]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([
      { id: 5, name: 'Yoga' },
      { id: 6, name: 'Boxing' },
    ]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([
      { id: 10, name: 'West Gym' },
      { id: 20, name: 'Central Gym' },
    ]);
    jest.spyOn(BookingsModel, 'getAll').mockResolvedValue([
      { session_id: 1 },
      { session_id: 1 },
      { session_id: 2 },
      { session_id: 'invalid' },
    ]);
    const res = response();

    for (const [sortBy, expectedIds] of [
      ['title', [2, 3, 1]],
      ['trainer', [3, 2, 1]],
      ['activity', [3, 2, 1]],
      ['location', [3, 2, 1]],
      ['date', [1, 2, 3]],
      ['bookings', [3, 2, 1]],
    ]) {
      await SessionsController.viewSessionManagement(request({}, { sort_by: sortBy }), res);
      expect(res.render.mock.calls.at(-1)[1].sessions.map(({ id }) => id)).toEqual(expectedIds);
    }

    await SessionsController.viewSessionManagement(request({}, { sort_by: 'invalid', sort_dir: 'desc' }), res);
    expect(res.render.mock.calls.at(-1)[1].selectedSortBy).toBe('date');
    expect(res.render.mock.calls.at(-1)[1].sessions.map(({ id }) => id)).toEqual([3, 2, 1]);
  });

  test('handles session CRUD requests', async () => {
    const res = response();
    const errorNext = next();
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(SessionsModel, 'getById').mockResolvedValue({ id: 1 });
    jest.spyOn(SessionsModel, 'create').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(SessionsModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(SessionsModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await SessionsController.list(request(), res, errorNext);
    await SessionsController.getById(request({ id: '1' }), res, errorNext);
    await SessionsController.create(request({}, {}, { activity_id: 7 }), res, errorNext);
    await SessionsController.update(request({ id: '1' }, {}, { activity_id: 8 }), res, errorNext);
    await SessionsController.delete(request({ id: '1' }), res, errorNext);

    expect(SessionsModel.update).toHaveBeenCalledWith({ activity_id: 8, id: 1 });
    expect(SessionsModel.delete).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('handles session management actions and failures', async () => {
    const res = response();
    jest.spyOn(SessionsModel, 'create').mockResolvedValue({});
    jest.spyOn(SessionsModel, 'update').mockResolvedValue({});
    jest.spyOn(SessionsModel, 'delete').mockResolvedValue({});
    jest.spyOn(BookingsModel, 'deleteBySessionId').mockResolvedValue({});
    jest.spyOn(ActivitiesModel, 'getById').mockResolvedValue({ name: 'Yoga' });
    jest.spyOn(UsersModel, 'getById').mockResolvedValue({ first_name: 'Ada', last_name: 'Lovelace' });

    await SessionsController.handleSessionManagement(request({}, {}, { action: 'create', activityId: 1, locationId: 2, trainerId: 3, date: '2026-09-26', time: '10:00', title: 'Test session' }), res);
    SessionsModel.create.mockClear();
    await SessionsController.handleSessionManagement(request({}, {}, { action: 'create', activity_id: 1, location_id: 2, trainer_id: 3, date: '2026-09-26', time: '10:00', title: 'Snake case session' }), res);
    expect(SessionsModel.create).toHaveBeenCalledWith(expect.objectContaining({
      activity_id: 1,
      location_id: 2,
      trainer_id: 3,
    }));
    for (const [time, normalizedTime] of [['9:00am', '09:00:00'], ['12:00am', '00:00:00'], ['12:00pm', '12:00:00'], ['2:00pm', '14:00:00'], ['10:00:00', '10:00:00']]) {
      SessionsModel.create.mockClear();
      await SessionsController.handleSessionManagement(request({}, {}, {
        action: 'create', activityId: 1, locationId: 2, trainerId: 3,
        date: '2026-09-26', time, title: 'Formatted time session',
      }), res);
      expect(SessionsModel.create).toHaveBeenCalledWith(expect.objectContaining({ time: normalizedTime }));
    }
    const completeSession = { activityId: 1, locationId: 2, trainerId: 3, date: '2026-09-26', time: '10:00', title: 'Test session' };
    await SessionsController.handleSessionManagement(request({ id: '1' }, {}, { ...completeSession, action: 'update' }), res);
    await SessionsController.handleSessionManagement(request({ id: '1' }, {}, { ...completeSession, action: 'delete' }), res);
    await SessionsController.handleSessionManagement(request({}, {}, { ...completeSession, action: 'unknown' }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    SessionsModel.create.mockRejectedValue(new Error('database error'));
    await SessionsController.handleSessionManagement(request({}, {}, { action: 'create', title: 'Test session', activityId: 1, locationId: 2, trainerId: 3, date: '2026-09-26', time: '10:00' }), res);
    expect(res.status).toHaveBeenCalledWith(500);

    SessionsModel.update.mockRejectedValue(new Error('database error'));
    await SessionsController.handleSessionManagement(request({ id: '1' }, {}, { ...completeSession, action: 'update' }), res);
    SessionsModel.delete.mockRejectedValue(new Error('database error'));
    await SessionsController.handleSessionManagement(request({ id: '1' }, {}, { ...completeSession, action: 'delete' }), res);
  });

  test('cascades booking deletion before deleting a session', async () => {
    const res = response();
    const completeSession = { activityId: 1, locationId: 2, trainerId: 3, date: '2026-09-26', time: '10:00', title: 'Test session' };
    const deleteBookings = jest.spyOn(BookingsModel, 'deleteBySessionId').mockResolvedValue({});
    const deleteSession = jest.spyOn(SessionsModel, 'delete').mockResolvedValue({});

    await SessionsController.handleSessionManagement(request({ id: '1' }, {}, { ...completeSession, action: 'delete' }), res);

    expect(deleteBookings).toHaveBeenCalledWith(1);
    expect(deleteSession).toHaveBeenCalledWith(1);
    expect(res.redirect).toHaveBeenCalledWith('/sessions');
  });

  test('prompts to confirm deletion when the selected session has bookings', async () => {
    const sessions = [{ id: 1, title: 'Morning Yoga', location_id: 2, trainer_id: 3, date: dateForOffset(0) }];
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue(sessions);
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(BookingsModel, 'getBySessionId').mockResolvedValue([{ id: 9, session_id: 1 }]);
    const res = response();

    await SessionsController.viewSessionManagement(request({ id: '1' }), res);

    expect(BookingsModel.getBySessionId).toHaveBeenCalledWith(1);
    expect(res.render).toHaveBeenCalledWith('session_management.ejs', expect.objectContaining({
      selectedSessionHasBookings: true,
    }));
  });

  test('rejects incomplete session data', () => {
    const res = response();

    SessionsController.handleSessionManagement(request({}, {}, { action: 'create', title: 'Incomplete' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('status.ejs', expect.objectContaining({
      status: 'Invalid Session',
    }));
  });

  test.each([
    [{ activityId: 'bad' }, 'Activity, location, and trainer must be valid selections.'],
    [{ activityId: '1', locationId: '2', trainerId: '3', date: '26/09/2026', time: '10:00' }, 'Date and time must be valid.'],
    [{ activityId: '1', locationId: '2', trainerId: '3', date: '2026-09-26', time: 'bad' }, 'Date and time must be valid.'],
  ])('rejects invalid session fields', (fields, message) => {
    const res = response();

    SessionsController.handleSessionManagement(request({}, {}, {
      action: 'create',
      title: 'Test session',
      date: '2026-09-26',
      time: '10:00',
      activityId: '1',
      locationId: '2',
      trainerId: '3',
      ...fields,
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('status.ejs', expect.objectContaining({ message }));
  });

  test('forwards errors from session JSON handlers', async () => {
    const error = new Error('database error');
    const errorNext = next();
    jest.spyOn(SessionsModel, 'getById').mockRejectedValue(error);
    jest.spyOn(SessionsModel, 'create').mockRejectedValue(error);
    jest.spyOn(SessionsModel, 'update').mockRejectedValue(error);
    jest.spyOn(SessionsModel, 'delete').mockRejectedValue(error);
    const res = response();

    await SessionsController.getById(request({ id: '1' }), res, errorNext);
    await SessionsController.create(request(), res, errorNext);
    await SessionsController.update(request({ id: '1' }), res, errorNext);
    await SessionsController.delete(request({ id: '1' }), res, errorNext);

    expect(errorNext).toHaveBeenCalledTimes(4);
  });

  test('forwards session errors', async () => {
    const error = new Error('database error');
    const errorNext = next();
    jest.spyOn(SessionsModel, 'getAll').mockRejectedValue(error);

    await SessionsController.list(request(), response(), errorNext);

    expect(errorNext).toHaveBeenCalledWith(error);
  });
});
