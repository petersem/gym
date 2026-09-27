import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { SessionsController } from '../../controllers/SessionsController.mjs';
import { SessionsModel } from '../../models/SessionsModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';
import { ActivitiesModel } from '../../models/ActivitiesModel.mjs';
import { LocationModel } from '../../models/LocationModel.mjs';

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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SessionsController', () => {
  test('renders session management and handles load errors', async () => {
    const sessions = [{ id: 1, location_id: 2, trainer_id: 3 }];
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue(sessions);
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([]);
    const res = response();

    await SessionsController.viewSessionManagement(request({ sid: 'abc' }), res);
    expect(res.render).toHaveBeenCalledWith('session_management.ejs', expect.objectContaining({ sessions }));

    await SessionsController.viewSessionManagement(request({ id: 'missing' }), res);
    expect(res.render).toHaveBeenCalledWith('session_management.ejs', expect.objectContaining({
      selectedSession: expect.objectContaining({ id: null }),
    }));

    await SessionsController.viewSessionManagement(request({}, { location_id: '2', trainer_id: '3' }), res);
    expect(res.render).toHaveBeenCalledWith('session_management.ejs', expect.objectContaining({ sessions }));

    SessionsModel.getAll.mockRejectedValue(new Error('database error'));
    await SessionsController.viewSessionManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
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
