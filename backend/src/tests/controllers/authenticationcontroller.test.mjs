import { afterEach, describe, expect, jest, test } from '@jest/globals';
import bcrypt from 'bcrypt';
import { AuthenticationController } from '../../controllers/AuthenticationController.mjs';
import { USER_ROLE_ADMIN, USER_ROLE_MEMBER, USER_ROLE_TRAINER, UsersModel } from '../../models/UsersModel.mjs';

const response = () => ({
  render: jest.fn(),
  redirect: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

const request = (body = {}, session = {}, authenticatedUser) => ({
  body,
  session,
  authenticatedUser,
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AuthenticationController', () => {
  test('loads a user from an authenticated session', async () => {
    const user = { id: 7 };
    jest.spyOn(UsersModel, 'getById').mockResolvedValue(user);
    const next = jest.fn();
    const provider = AuthenticationController.middleware.stack[1].handle;
    const req = request({}, { userId: 7 });

    await provider(req, {}, next);

    expect(req.authenticatedUser).toBe(user);
    expect(next).toHaveBeenCalled();
  });

  test('does not reload an already authenticated session', async () => {
    const next = jest.fn();
    const provider = AuthenticationController.middleware.stack[1].handle;
    const req = request({}, { userId: 7 }, { id: 7 });
    const lookup = jest.spyOn(UsersModel, 'getById');

    await provider(req, {}, next);

    expect(lookup).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('continues when session authentication lookup fails', async () => {
    jest.spyOn(UsersModel, 'getById').mockRejectedValue(new Error('database error'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const next = jest.fn();
    const provider = AuthenticationController.middleware.stack[1].handle;

    await provider(request({}, { userId: 7 }), {}, next);

    expect(next).toHaveBeenCalled();
  });

  test('renders the login page', () => {
    const res = response();

    AuthenticationController.viewLogin({}, res);

    expect(res.render).toHaveBeenCalledWith('login.ejs');
  });

  test('renders the registration page', () => {
    const res = response();

    AuthenticationController.viewRegister({}, res);

    expect(res.render).toHaveBeenCalledWith('register.ejs');
  });

  test.each([
    [USER_ROLE_ADMIN, '/'],
    [USER_ROLE_TRAINER, '/'],
    [USER_ROLE_MEMBER, '/'],
  ])('logs in a %s user', async (role, redirect) => {
    const user = { id: 7, role, password: 'hash' };
    jest.spyOn(UsersModel, 'getByUsername').mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    const req = request({ username: 'ada@example.com', password: 'secret' });
    const res = response();

    await AuthenticationController.handleLogin(req, res);

    expect(req.session.userId).toBe(7);
    expect(res.redirect).toHaveBeenCalledWith(redirect);
  });

  test('redirects an authenticated user with an unknown role to locations', async () => {
    jest.spyOn(UsersModel, 'getByUsername').mockResolvedValue({ id: 7, role: 'unknown', password: 'hash' });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    const res = response();

    await AuthenticationController.handleLogin(request({ username: 'ada@example.com', password: 'secret' }), res);

    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  test('registers a member account', async () => {
    const create = jest.spyOn(UsersModel, 'create').mockResolvedValue({ insertId: 8 });
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password');
    const res = response();

    await AuthenticationController.handleRegister(request({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'plain-password',
      phone: '555-0100',
      dob: '1815-12-10',
    }), res);

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      role: 'member',
      password: 'hashed-password',
    }));
    expect(res.redirect).toHaveBeenCalledWith('/authenticate');
  });

  test('rejects incomplete registration data', async () => {
    const res = response();

    await AuthenticationController.handleRegister(request({ email: 'ada@example.com' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('status.ejs', expect.objectContaining({
      status: 'Registration Failed.',
    }));
  });

  test('reports registration database errors', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-password');
    jest.spyOn(UsersModel, 'create').mockRejectedValue(new Error('duplicate email'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();

    await AuthenticationController.handleRegister(request({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'plain-password',
      phone: '555-0100',
    }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('status.ejs', expect.objectContaining({
      message: 'The account could not be created.',
    }));
  });

  test('rejects an incorrect password', async () => {
    jest.spyOn(UsersModel, 'getByUsername').mockResolvedValue({ password: 'hash' });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
    const res = response();

    await AuthenticationController.handleLogin(request({ username: 'ada@example.com', password: 'wrong' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith('status.ejs', expect.objectContaining({ status: 'Authentication Failed.' }));
  });

  test('rejects an unknown user', async () => {
    jest.spyOn(UsersModel, 'getByUsername').mockRejectedValue('not found');
    const res = response();

    await AuthenticationController.handleLogin(request({ username: 'missing@example.com', password: 'secret' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('reports authentication server errors', async () => {
    const error = new Error('database error');
    jest.spyOn(UsersModel, 'getByUsername').mockRejectedValue(error);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();

    await AuthenticationController.handleLogin(request({ username: 'ada@example.com', password: 'secret' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.render).toHaveBeenCalledWith('status.ejs', expect.objectContaining({ message: 'Server error.' }));
  });

  test('logs out an authenticated user', () => {
    const destroy = jest.fn();
    const res = response();

    AuthenticationController.handleLogout(request({}, { userId: 7, destroy }, { id: 7 }), res);

    expect(destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('rejects logout without authentication', () => {
    const res = response();

    AuthenticationController.handleLogout(request(), res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('does not render when an authenticated user has no session id', () => {
    const res = response();

    AuthenticationController.handleLogout(request({}, {}, { id: 7 }), res);

    expect(res.render).not.toHaveBeenCalled();
  });

  test('allows an authorized role', () => {
    const next = jest.fn();
    const res = response();

    AuthenticationController.restrict(['admin'])(request({}, {}, { role: 'admin' }), res, next);

    expect(next).toHaveBeenCalled();
  });

  test('rejects a forbidden role', () => {
    const res = response();

    AuthenticationController.restrict(['admin'])(request({}, {}, { role: 'member' }), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('rejects an unauthenticated request', () => {
    const res = response();

    AuthenticationController.restrict(['admin'])(request(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
