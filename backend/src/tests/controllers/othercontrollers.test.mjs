import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { ActivitiesController } from '../../controllers/ActivitiesController.mjs';
import { BlogController } from '../../controllers/BlogController.mjs';
import { BookingsController } from '../../controllers/BookingsController.mjs';
import { SessionsController } from '../../controllers/SessionsController.mjs';
import { ActivitiesModel } from '../../models/ActivitiesModel.mjs';
import { BlogModel } from '../../models/BlogModel.mjs';
import { BookingsModel } from '../../models/BookingsModel.mjs';
import { SessionsModel } from '../../models/SessionsModel.mjs';

const response = () => {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
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
});

describe('BlogController', () => {
  test('lists and searches blog posts', async () => {
    const blogs = [{ id: 1 }];
    const getAll = jest.spyOn(BlogModel, 'getAll').mockResolvedValue(blogs);
    const search = jest.spyOn(BlogModel, 'getBySearch').mockResolvedValue(blogs);
    const res = response();

    await BlogController.list(request(), res, next());
    await BlogController.list(request({}, { search_term: 'training' }), res, next());

    expect(getAll).toHaveBeenCalled();
    expect(search).toHaveBeenCalledWith('training');
    expect(res.json).toHaveBeenCalledWith(blogs);
  });

  test('handles blog CRUD requests and forwards errors', async () => {
    const res = response();
    const errorNext = next();
    jest.spyOn(BlogModel, 'getById').mockResolvedValue({ id: 2 });
    jest.spyOn(BlogModel, 'create').mockResolvedValue({ insertId: 2 });
    jest.spyOn(BlogModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(BlogModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await BlogController.getById(request({ id: '2' }), res, errorNext);
    await BlogController.create(request({}, {}, { title: 'Post' }), res, errorNext);
    await BlogController.update(request({ id: '2' }, {}, { title: 'Updated' }), res, errorNext);
    await BlogController.delete(request({ id: '2' }), res, errorNext);

    expect(BlogModel.update).toHaveBeenCalledWith({ title: 'Updated', id: 2 });
    expect(BlogModel.delete).toHaveBeenCalledWith(2);
    expect(res.status).toHaveBeenCalledWith(201);

    const error = new Error('database error');
    jest.spyOn(BlogModel, 'getAll').mockRejectedValue(error);
    await BlogController.list(request(), res, errorNext);
    expect(errorNext).toHaveBeenCalledWith(error);
  });
});

describe('BookingsController', () => {
  test('handles booking CRUD requests', async () => {
    const res = response();
    const errorNext = next();
    jest.spyOn(BookingsModel, 'getAll').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(BookingsModel, 'getById').mockResolvedValue({ id: 1 });
    jest.spyOn(BookingsModel, 'create').mockResolvedValue({ insertId: 1 });
    jest.spyOn(BookingsModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(BookingsModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await BookingsController.list(request(), res, errorNext);
    await BookingsController.getById(request({ id: '1' }), res, errorNext);
    await BookingsController.create(request({}, {}, { user_id: 7 }), res, errorNext);
    await BookingsController.update(request({ id: '1' }, {}, { user_id: 8 }), res, errorNext);
    await BookingsController.delete(request({ id: '1' }), res, errorNext);

    expect(BookingsModel.update).toHaveBeenCalledWith({ user_id: 8, id: 1 });
    expect(BookingsModel.delete).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('forwards booking errors', async () => {
    const error = new Error('database error');
    const errorNext = next();
    jest.spyOn(BookingsModel, 'getAll').mockRejectedValue(error);

    await BookingsController.list(request(), response(), errorNext);

    expect(errorNext).toHaveBeenCalledWith(error);
  });
});

describe('SessionsController', () => {
  test('handles session CRUD requests', async () => {
    const res = response();
    const errorNext = next();
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue([{ sid: 'abc' }]);
    jest.spyOn(SessionsModel, 'getById').mockResolvedValue({ sid: 'abc' });
    jest.spyOn(SessionsModel, 'create').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(SessionsModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(SessionsModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await SessionsController.list(request(), res, errorNext);
    await SessionsController.getById(request({ sid: 'abc' }), res, errorNext);
    await SessionsController.create(request({}, {}, { data: '{}' }), res, errorNext);
    await SessionsController.update(request({ sid: 'abc' }, {}, { data: '{"userId": 7}' }), res, errorNext);
    await SessionsController.delete(request({ sid: 'abc' }), res, errorNext);

    expect(SessionsModel.update).toHaveBeenCalledWith({ data: '{"userId": 7}', sid: 'abc' });
    expect(SessionsModel.delete).toHaveBeenCalledWith('abc');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('forwards session errors', async () => {
    const error = new Error('database error');
    const errorNext = next();
    jest.spyOn(SessionsModel, 'getAll').mockRejectedValue(error);

    await SessionsController.list(request(), response(), errorNext);

    expect(errorNext).toHaveBeenCalledWith(error);
  });
});