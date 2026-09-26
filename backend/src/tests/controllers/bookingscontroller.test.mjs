import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { BookingsController } from '../../controllers/BookingsController.mjs';
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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BookingsController', () => {
  test('renders booking management and handles load errors', async () => {
    const bookings = [{ id: 1 }];
    jest.spyOn(BookingsModel, 'getAll').mockResolvedValue(bookings);
    const res = response();

    await BookingsController.viewBookingManagement(request({ id: '1' }), res);
    expect(res.render).toHaveBeenCalledWith('booking_management.ejs', expect.objectContaining({ bookings }));

    await BookingsController.viewBookingManagement(request({ id: '999' }), res);
    expect(res.render).toHaveBeenCalledWith('booking_management.ejs', expect.objectContaining({
      selectedBooking: expect.objectContaining({ id: null }),
    }));

    BookingsModel.getAll.mockRejectedValue(new Error('database error'));
    await BookingsController.viewBookingManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

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

  test('handles booking management actions and failures', async () => {
    const res = response();
    jest.spyOn(BookingsModel, 'create').mockResolvedValue({});
    jest.spyOn(BookingsModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(BookingsModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await BookingsController.handleBookingManagement(request({}, {}, { action: 'create' }), res);
    await BookingsController.handleBookingManagement(request({ id: '2' }, {}, { action: 'update' }), res);
    await BookingsController.handleBookingManagement(request({ id: '2' }, {}, { action: 'delete' }), res);

    BookingsModel.update.mockResolvedValue({ affectedRows: 0 });
    await BookingsController.handleBookingManagement(request({ id: '2' }, {}, { action: 'update' }), res);
    BookingsModel.delete.mockResolvedValue({ affectedRows: 0 });
    await BookingsController.handleBookingManagement(request({ id: '2' }, {}, { action: 'delete' }), res);
    await BookingsController.handleBookingManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).toHaveBeenCalledWith(400);

    BookingsModel.create.mockRejectedValue(new Error('database error'));
    await BookingsController.handleBookingManagement(request({}, {}, { action: 'create' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('forwards errors from booking JSON handlers', async () => {
    const error = new Error('database error');
    const errorNext = next();
    jest.spyOn(BookingsModel, 'getById').mockRejectedValue(error);
    jest.spyOn(BookingsModel, 'create').mockRejectedValue(error);
    jest.spyOn(BookingsModel, 'update').mockRejectedValue(error);
    jest.spyOn(BookingsModel, 'delete').mockRejectedValue(error);
    const res = response();

    await BookingsController.getById(request({ id: '1' }), res, errorNext);
    await BookingsController.create(request(), res, errorNext);
    await BookingsController.update(request({ id: '1' }), res, errorNext);
    await BookingsController.delete(request({ id: '1' }), res, errorNext);

    expect(errorNext).toHaveBeenCalledTimes(4);
  });

  test('forwards booking errors', async () => {
    const error = new Error('database error');
    const errorNext = next();
    jest.spyOn(BookingsModel, 'getAll').mockRejectedValue(error);

    await BookingsController.list(request(), response(), errorNext);

    expect(errorNext).toHaveBeenCalledWith(error);
  });
});
