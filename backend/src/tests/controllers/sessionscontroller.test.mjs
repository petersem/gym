import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { SessionsController } from '../../controllers/SessionsController.mjs';
import { SessionsModel } from '../../models/SessionsModel.mjs';

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
    const sessions = [{ id: 1 }];
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue(sessions);
    const res = response();

    await SessionsController.viewSessionManagement(request({ sid: 'abc' }), res);
    expect(res.render).toHaveBeenCalledWith('session_management.ejs', expect.objectContaining({ sessions }));

    await SessionsController.viewSessionManagement(request({ id: 'missing' }), res);
    expect(res.render).toHaveBeenCalledWith('session_management.ejs', expect.objectContaining({
      selectedSession: expect.objectContaining({ id: null }),
    }));

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

    await SessionsController.handleSessionManagement(request({}, {}, { action: 'create', activityId: 1 }), res);
    await SessionsController.handleSessionManagement(request({ id: '1' }, {}, { action: 'update' }), res);
    await SessionsController.handleSessionManagement(request({ id: '1' }, {}, { action: 'delete' }), res);
    await SessionsController.handleSessionManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(400);

    SessionsModel.create.mockRejectedValue(new Error('database error'));
    await SessionsController.handleSessionManagement(request({}, {}, { action: 'create' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
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
