import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { BookingsController } from '../../controllers/BookingsController.mjs';
import { BookingsModel } from '../../models/BookingsModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';
import { SessionsModel } from '../../models/SessionsModel.mjs';
import { LocationModel } from '../../models/LocationModel.mjs';
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

const request = (params = {}, query = {}, body = {}, authenticatedUser) => ({ params, query, body, authenticatedUser });
const next = () => jest.fn();

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BookingsController', () => {
  test('renders booking management and handles load errors', async () => {
    const bookings = [{ id: 1, session_id: 4, user_id: 7 }];
    const authenticatedUser = { id: 7, role: 'member' };
    const sessions = [{ id: 4, location_id: 9, activity_id: 3, trainer_id: 12, date: new Date().toISOString().slice(0, 10), time: '10:00:00' }];
    const activities = [{ id: 3, name: 'Yoga' }];
    const getByUserId = jest.spyOn(BookingsModel, 'getByUserId').mockResolvedValue(bookings);
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([{ id: 12, first_name: 'Taylor', last_name: 'Trainer' }]);
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue(sessions);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([{ id: 9, name: 'Central Gym' }]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue(activities);
    const res = response();

    await BookingsController.viewBookingManagement(request({ id: '1' }, {}, {}, authenticatedUser), res);
    expect(getByUserId).toHaveBeenCalledWith(7);
    expect(res.render).toHaveBeenCalledWith('booking_management.ejs', expect.objectContaining({ bookings, activities }));
    expect(res.render).toHaveBeenCalledWith('booking_management.ejs', expect.objectContaining({
      bookingUserId: 7,
      canManageBookings: false,
    }));

    await BookingsController.viewBookingManagement(request({ id: '999' }, {}, {}, authenticatedUser), res);
    expect(res.render).toHaveBeenCalledWith('booking_management.ejs', expect.objectContaining({
      selectedBooking: expect.objectContaining({ id: null }),
    }));

    await BookingsController.viewBookingManagement(request({ id: '1' }, { available_location_id: '9' }, {}, authenticatedUser), res);
    await BookingsController.viewBookingManagement(request({ id: '1' }, { booking_location_id: '9' }, {}, authenticatedUser), res);
    await BookingsController.viewBookingManagement(request({}, { session_id: '4' }, {}, authenticatedUser), res);
    expect(res.render).toHaveBeenCalledWith('booking_management.ejs', expect.objectContaining({
      selectedBooking: expect.objectContaining({ session_id: '4' }),
    }));

    await BookingsController.viewBookingManagement(request({}, { booking_deleted: '1' }, {}, authenticatedUser), res);
    expect(res.render).toHaveBeenCalledWith('booking_management.ejs', expect.objectContaining({ bookingDeleted: true }));

    getByUserId.mockRejectedValue(new Error('database error'));
    await BookingsController.viewBookingManagement(request({}, {}, {}, authenticatedUser), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('does not load any bookings when the request is unauthenticated', async () => {
    const getByUserId = jest.spyOn(BookingsModel, 'getByUserId');
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([]);
    const res = response();

    await BookingsController.viewBookingManagement(request(), res);

    expect(getByUserId).not.toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('booking_management.ejs', expect.objectContaining({ bookings: [] }));
  });

  test.each(['admin', 'trainer'])('%s can view all bookings and filter by user', async (role) => {
    const bookings = [
      { id: 1, session_id: 4, user_id: 7 },
      { id: 2, session_id: 4, user_id: 8 },
    ];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sessionDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    const getAll = jest.spyOn(BookingsModel, 'getAll').mockResolvedValue(bookings);
    const getByUserId = jest.spyOn(BookingsModel, 'getByUserId');
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([
      { id: 7, first_name: 'Alex', last_name: 'Member' },
      { id: 8, first_name: 'Sam', last_name: 'Member' },
    ]);
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue([
      { id: 4, location_id: 9, date: sessionDate, time: '10:00:00' },
    ]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([]);
    const res = response();
    const authenticatedUser = { id: 1, role };

    await BookingsController.viewBookingManagement(request({}, {}, {}, authenticatedUser), res);
    expect(getAll).toHaveBeenCalled();
    expect(getByUserId).not.toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith('booking_management.ejs', expect.objectContaining({
      canManageBookings: true,
      bookingUserId: null,
    }));
    expect(res.render.mock.calls.at(-1)[1].bookingCalendarDays[0].bookings).toEqual(bookings);

    await BookingsController.viewBookingManagement(request({}, { booking_user_id: '8' }, {}, authenticatedUser), res);
    const selectedUserData = res.render.mock.calls.at(-1)[1];
    expect(selectedUserData.bookingUserId).toBe(8);
    expect(selectedUserData.bookingCalendarDays[0].bookings).toEqual([bookings[1]]);

    await BookingsController.viewBookingManagement(request({ id: '2' }, { booking_user_id: '8' }, {}, authenticatedUser), res);
    expect(res.render.mock.calls.at(-1)[1].selectedBooking.id).toBe(2);
  });

  test('groups sessions by their local calendar date', async () => {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sessionDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, '0'),
      String(tomorrow.getDate()).padStart(2, '0'),
    ].join('-');
    const session = { id: 22, location_id: 1, date: sessionDate, time: '10:00:00' };
    jest.spyOn(BookingsModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(SessionsModel, 'getAll').mockResolvedValue([session]);
    jest.spyOn(LocationModel, 'getAll').mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, 'getAll').mockResolvedValue([]);
    const res = response();

    await BookingsController.viewBookingManagement(request(), res);

    const { calendarDays } = res.render.mock.calls[0][1];
    expect(calendarDays[1].dateValue).toBe(sessionDate);
    expect(calendarDays[1].sessions).toEqual([session]);
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

    BookingsModel.create.mockResolvedValueOnce({ affectedRows: 0, duplicate: true });
    await BookingsController.create(request({}, {}, { session_id: 4, user_id: 7 }), res, errorNext);

    expect(BookingsModel.update).toHaveBeenCalledWith({ user_id: 8, id: 1 });
    expect(BookingsModel.delete).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('handles booking management actions and failures', async () => {
    const res = response();
    jest.spyOn(BookingsModel, 'create').mockResolvedValue({});
    jest.spyOn(BookingsModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(BookingsModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await BookingsController.handleBookingManagement(request({}, {}, { action: 'create' }), res);
    await BookingsController.handleBookingManagement(request({ id: '2' }, {}, { action: 'update' }), res);
    await BookingsController.handleBookingManagement(request({ id: '2' }, {}, { action: 'delete' }), res);
    expect(res.redirect).toHaveBeenCalledWith('/bookings?booking_deleted=1');

    await BookingsController.handleBookingManagement(request(
      { id: '2' }, { booking_user_id: '8' }, { action: 'delete' },
    ), res);
    expect(res.redirect).toHaveBeenCalledWith('/bookings?booking_user_id=8&booking_deleted=1');

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

    BookingsModel.update.mockRejectedValue(new Error('database error'));
    await BookingsController.handleBookingManagement(request({ id: '2' }, {}, { action: 'update' }), res);
    BookingsModel.delete.mockRejectedValue(new Error('database error'));
    await BookingsController.handleBookingManagement(request({ id: '2' }, {}, { action: 'delete' }), res);
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
