import { afterEach, describe, expect, jest, test } from "@jest/globals";
import bcrypt from "bcrypt";
import { runFormValidation } from "../helpers/formValidation.mjs";
import { AuthenticationController } from "../../controllers/AuthenticationController.mjs";
import {
  USER_ROLE_ADMIN,
  USER_ROLE_MEMBER,
  USER_ROLE_TRAINER,
  UsersModel,
} from "../../models/UsersModel.mjs";

const response = () => ({
  locals: {},
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

// Model spies isolate session and credential handling from database behavior.
describe("AuthenticationController", () => {
  test("loads a user from an authenticated session", async () => {
    const user = { id: 7, role: "member" };
    jest.spyOn(UsersModel, "getById").mockResolvedValue(user);
    const next = jest.fn();
    const provider = AuthenticationController.middleware.stack[1].handle;
    const req = request({}, { userId: 7 });

    const res = response();
    await provider(req, res, next);

    expect(req.authenticatedUser).toBe(user);
    expect(res.locals).toEqual({ authenticatedUser: user, role: "member" });
    expect(next).toHaveBeenCalled();
  });

  test("continues when session authentication lookup fails", async () => {
    jest
      .spyOn(UsersModel, "getById")
      .mockRejectedValue(new Error("database error"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const next = jest.fn();
    const provider = AuthenticationController.middleware.stack[1].handle;

    const res = response();
    await provider(request({}, { userId: 7 }), res, next);
    expect(res.locals).toEqual({ authenticatedUser: undefined, role: "" });

    expect(next).toHaveBeenCalled();
  });

  test.each([
    [USER_ROLE_ADMIN, "/"],
    [USER_ROLE_TRAINER, "/"],
    [USER_ROLE_MEMBER, "/"],
  ])("logs in a %s user", async (role, redirect) => {
    const user = { id: 7, role, password: "hash" };
    jest.spyOn(UsersModel, "getByUsername").mockResolvedValue(user);
    jest.spyOn(bcrypt, "compare").mockResolvedValue(true);
    const req = request({ username: "ada@example.com", password: "secret" });
    const res = response();

    await AuthenticationController.handleLogin(req, res);

    expect(req.session.userId).toBe(7);
    expect(res.redirect).toHaveBeenCalledWith(redirect);
  });

  test("registers a member account", async () => {
    const create = jest
      .spyOn(UsersModel, "create")
      .mockResolvedValue({ insertId: 8 });
    jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed-password");
    const res = response();

    await AuthenticationController.handleRegister(
      request({
        firstName: "Fred",
        lastName: "Nerk",
        email: "fn@gym.com",
        password: "plain-password",
        phone: "555-0100",
        dob: "1815-12-10",
      }),
      res,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "member",
        password: "hashed-password",
      }),
    );
    expect(res.redirect).toHaveBeenCalledWith("/authenticate");
  });

  test("rejects incomplete registration data", async () => {
    const res = response();

    await runFormValidation(
      "register",
      request({ email: "ada@example.com" }),
      res,
    );

    expect(res.redirect).toHaveBeenCalledWith(
      303,
      "/authenticate/register#form-validation",
    );
    expect(res.render).not.toHaveBeenCalled();
  });

  test("rejects an incorrect password", async () => {
    jest
      .spyOn(UsersModel, "getByUsername")
      .mockResolvedValue({ password: "hash" });
    jest.spyOn(bcrypt, "compare").mockResolvedValue(false);
    const res = response();

    await AuthenticationController.handleLogin(
      request({ username: "ada@example.com", password: "wrong" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.render).toHaveBeenCalledWith(
      "status.ejs",
      expect.objectContaining({ status: "Authentication Failed." }),
    );
  });

  test("rejects an unknown user", async () => {
    jest.spyOn(UsersModel, "getByUsername").mockRejectedValue("not found");
    const res = response();

    await AuthenticationController.handleLogin(
      request({ username: "missing@example.com", password: "secret" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("reports authentication server errors", async () => {
    const error = new Error("database error");
    jest.spyOn(UsersModel, "getByUsername").mockRejectedValue(error);
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = response();

    await AuthenticationController.handleLogin(
      request({ username: "ada@example.com", password: "secret" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.render).toHaveBeenCalledWith(
      "status.ejs",
      expect.objectContaining({ message: "Server error." }),
    );
  });

  test("logs out an authenticated user", () => {
    const destroy = jest.fn();
    const res = response();

    AuthenticationController.handleLogout(
      request({}, { userId: 7, destroy }, { id: 7 }),
      res,
    );

    expect(destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
