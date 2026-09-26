import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { LocationController } from '../../controllers/LocationController.mjs';
import { LocationModel } from '../../models/LocationModel.mjs';

const response = () => ({
  render: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

const request = (query = {}, params = {}) => ({ query, params, authenticatedUser: { id: 1 } });
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LocationController', () => {
  test('renders all locations', async () => {
    const locations = [{ id: 1 }];
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue(locations);
    const res = response();

    LocationController.viewLocationList(request(), res);
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith('location_list.ejs', {
      locations,
      authenticatedUser: { id: 1 },
    });
  });

  test('renders searched locations', async () => {
    const locations = [{ id: 2 }];
    const search = jest.spyOn(LocationModel, 'getBySearch').mockResolvedValue(locations);
    const res = response();

    LocationController.viewLocationList(request({ search_term: 'Central' }), res);
    await flushPromises();

    expect(search).toHaveBeenCalledWith('Central');
    expect(res.render).toHaveBeenCalledWith('location_list.ejs', expect.objectContaining({ locations }));
  });

  test('logs location list errors', async () => {
    const error = new Error('database error');
    jest.spyOn(LocationModel, 'getAll').mockRejectedValue(error);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();

    LocationController.viewLocationList(request(), res);
    await flushPromises();

    expect(log).toHaveBeenCalledWith(error);
  });

  test('logs searched-location errors', async () => {
    const error = new Error('database error');
    jest.spyOn(LocationModel, 'getBySearch').mockRejectedValue(error);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});

    LocationController.viewLocationList(request({ search_term: 'Central' }), response());
    await flushPromises();

    expect(log).toHaveBeenCalledWith(error);
  });

  test('reports that sales are unavailable', () => {
    const res = response();

    LocationController.viewLocationSales(request(), res);

    expect(res.status).toHaveBeenCalledWith(501);
    expect(res.render).toHaveBeenCalledWith('status.ejs', {
      status: 'Sales Unavailable',
      message: 'Location sales are not available yet.',
    });
  });

  test('renders location details', async () => {
    const location = { id: 3 };
    jest.spyOn(LocationModel, 'getById').mockResolvedValue(location);
    const res = response();

    LocationController.viewLocationDetails(request({}, { id: '3' }), res);
    await flushPromises();

    expect(LocationModel.getById).toHaveBeenCalledWith('3');
    expect(res.render).toHaveBeenCalledWith('location_details.ejs', { location });
  });

  test('renders not-found status for missing location details', async () => {
    jest.spyOn(LocationModel, 'getById').mockRejectedValue('not found');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();

    LocationController.viewLocationDetails(request({}, { id: '999' }), res);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render).toHaveBeenCalledWith('status.ejs', {
      status: 'Location not found',
      message: 'Maybe your location ID is invalid?',
    });
  });
});
