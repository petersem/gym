import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { ActivitiesController } from '../../controllers/ActivitiesController.mjs';
import { ActivitiesModel } from '../../models/ActivitiesModel.mjs';

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

describe('ActivitiesController', () => {
  test('renders activity management and handles load errors', async () => {
    const activities = [{ id: 1 }];
    jest.spyOn(ActivitiesModel, 'list').mockResolvedValue({ activities, total: 1 });
    const res = response();

    await ActivitiesController.viewActivityManagement(request({ id: '1' }), res);
    expect(res.render).toHaveBeenCalledWith('activity_management.ejs', expect.objectContaining({ activities }));

    await ActivitiesController.viewActivityManagement(request({ id: '999' }), res);
    expect(res.render).toHaveBeenCalledWith('activity_management.ejs', expect.objectContaining({
      selectedActivity: expect.objectContaining({ id: null }),
    }));

    ActivitiesModel.list.mockRejectedValue(new Error('database error'));
    await ActivitiesController.viewActivityManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('handles activity management actions and failures', async () => {
    const res = response();
    jest.spyOn(ActivitiesModel, 'create').mockResolvedValue({});
    jest.spyOn(ActivitiesModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(ActivitiesModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await ActivitiesController.handleActivityManagement(request({}, {}, { action: 'create', name: 'Yoga' }), res);
    await ActivitiesController.handleActivityManagement(request({ id: '2' }, {}, { action: 'update', name: 'Pilates' }), res);
    await ActivitiesController.handleActivityManagement(request({ id: '2' }, {}, { action: 'delete' }), res);
    expect(res.redirect).toHaveBeenCalledWith('/activities');

    ActivitiesModel.update.mockResolvedValue({ affectedRows: 0 });
    await ActivitiesController.handleActivityManagement(request({ id: '2' }, {}, { action: 'update' }), res);
    ActivitiesModel.delete.mockResolvedValue({ affectedRows: 0 });
    await ActivitiesController.handleActivityManagement(request({ id: '2' }, {}, { action: 'delete' }), res);
    await ActivitiesController.handleActivityManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).toHaveBeenCalledWith(400);

    ActivitiesModel.create.mockRejectedValue(new Error('database error'));
    await ActivitiesController.handleActivityManagement(request({}, {}, { action: 'create' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('lists activities', async () => {
    const activities = [{ id: 1 }];
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue(activities);
    const res = response();

    await ActivitiesController.list(request(), res, next());

    expect(res.json).toHaveBeenCalledWith(activities);
  });

  test('searches activities when a search term is supplied', async () => {
    const activities = [{ id: 1 }];
    const search = jest.spyOn(ActivitiesModel, 'getBySearch').mockResolvedValue(activities);
    const res = response();

    await ActivitiesController.list(request({}, { search_term: 'yoga' }), res, next());

    expect(search).toHaveBeenCalledWith('yoga');
    expect(res.json).toHaveBeenCalledWith(activities);
  });

  test('handles activity CRUD requests and forwards errors', async () => {
    const res = response();
    const errorNext = next();
    jest.spyOn(ActivitiesModel, 'getById').mockResolvedValue({ id: 2 });
    jest.spyOn(ActivitiesModel, 'create').mockResolvedValue({ insertId: 2 });
    jest.spyOn(ActivitiesModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(ActivitiesModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await ActivitiesController.getById(request({ id: '2' }), res, errorNext);
    await ActivitiesController.create(request({}, {}, { name: 'Yoga' }), res, errorNext);
    await ActivitiesController.update(request({ id: '2' }, {}, { name: 'Pilates' }), res, errorNext);
    await ActivitiesController.delete(request({ id: '2' }), res, errorNext);

    expect(ActivitiesModel.update).toHaveBeenCalledWith({ name: 'Pilates', id: 2 });
    expect(ActivitiesModel.delete).toHaveBeenCalledWith(2);
    expect(res.status).toHaveBeenCalledWith(201);

    const error = new Error('database error');
    jest.spyOn(ActivitiesModel, 'getAll').mockRejectedValue(error);
    await ActivitiesController.list(request(), res, errorNext);
    expect(errorNext).toHaveBeenCalledWith(error);
  });

  test('forwards errors from activity JSON handlers', async () => {
    const error = new Error('database error');
    const errorNext = next();
    jest.spyOn(ActivitiesModel, 'getById').mockRejectedValue(error);
    jest.spyOn(ActivitiesModel, 'create').mockRejectedValue(error);
    jest.spyOn(ActivitiesModel, 'update').mockRejectedValue(error);
    jest.spyOn(ActivitiesModel, 'delete').mockRejectedValue(error);
    const res = response();

    await ActivitiesController.getById(request({ id: '1' }), res, errorNext);
    await ActivitiesController.create(request(), res, errorNext);
    await ActivitiesController.update(request({ id: '1' }), res, errorNext);
    await ActivitiesController.delete(request({ id: '1' }), res, errorNext);

    expect(errorNext).toHaveBeenCalledTimes(4);
  });
});
