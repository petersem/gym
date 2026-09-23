import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { UsersController } from '../../controllers/UsersController.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';

const existingUser = new UsersModel(
  7,
  'Ada',
  'Lovelace',
  'member',
  'ada@example.com',
  '$2a$10$already-hashed',
  '555-0100',
  '1815-12-10',
  0,
  'auth-key',
);

const request = (params = {}, body = {}) => ({ params, body });

const response = () => ({
  render: jest.fn(),
  redirect: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const formData = (action) => ({
  action,
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'member',
  email: 'ada@example.com',
  password: '$2a$10$already-hashed',
  phone: '555-0100',
  dob: '1815-12-10',
  deleted: 0,
  updatedBy: 3,
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('UsersController unit tests', () => {
  test('renders users and the selected user', async () => {
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([existingUser]);
    const res = response();

    UsersController.viewUserManagement(request({ id: '7' }), res);
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith('user_management.ejs', {
      users: [existingUser],
      selectedUser: existingUser,
      role: 'admin',
    });
  });

  test('renders a complete empty user when no user is selected', async () => {
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    const res = response();

    UsersController.viewUserManagement(request({}), res);
    await flushPromises();

    const renderedUser = res.render.mock.calls[0][1].selectedUser;
    expect(renderedUser).toBeInstanceOf(UsersModel);
    expect(renderedUser).toMatchObject({
      id: null,
      first_name: '',
      last_name: '',
      email: '',
      deleted: 0,
      authentication_key: 0,
    });
  });

  test('creates a user and redirects', async () => {
    const create = jest.spyOn(UsersModel, 'create').mockResolvedValue({ insertId: 7 });
    const res = response();

    UsersController.handleUserManagement(request({}, formData('create')), res);
    await flushPromises();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      first_name: 'Ada',
      email: 'ada@example.com',
    }));
    expect(res.redirect).toHaveBeenCalledWith('/users');
  });

  test('updates a user when the database changes a row', async () => {
    const update = jest.spyOn(UsersModel, 'update').mockResolvedValue({ affectedRows: 1 });
    const res = response();

    UsersController.handleUserManagement(request({ id: '7' }, formData('update')), res);
    await flushPromises();

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: '7' }));
    expect(res.redirect).toHaveBeenCalledWith('/users');
  });

  test('renders an update failure when no row changes', async () => {
    jest.spyOn(UsersModel, 'update').mockResolvedValue({ affectedRows: 0 });
    const res = response();

    UsersController.handleUserManagement(request({ id: '7' }, formData('update')), res);
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith('status.ejs', {
      status: 'User Update Failed',
      message: 'The user could not be found.',
    });
  });

  test('deletes a user and redirects when a row is deleted', async () => {
    const remove = jest.spyOn(UsersModel, 'delete').mockResolvedValue({ affectedRows: 1 });
    const res = response();

    UsersController.handleUserManagement(request({ id: '7' }, formData('delete')), res);
    await flushPromises();

    expect(remove).toHaveBeenCalledWith('7');
    expect(res.redirect).toHaveBeenCalledWith('/users');
  });

  test('renders a deletion failure when no row is deleted', async () => {
    jest.spyOn(UsersModel, 'delete').mockResolvedValue({ affectedRows: 0 });
    const res = response();

    UsersController.handleUserManagement(request({ id: '7' }, formData('delete')), res);
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith('status.ejs', {
      status: 'User Deletion Failed',
      message: 'The user could not be found.',
    });
  });

  test('renders an invalid action error', () => {
    const res = response();

    UsersController.handleUserManagement(request({}, formData('unknown')), res);

    expect(res.render).toHaveBeenCalledWith('status.ejs', {
      status: 'Invalid Action',
      message: "The form doesn't support this action.",
    });
  });
});