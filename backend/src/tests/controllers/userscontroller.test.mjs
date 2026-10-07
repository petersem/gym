import { afterEach, describe, expect, jest, test } from "@jest/globals";
import bcrypt from "bcrypt";
import { UsersController } from "../../controllers/UsersController.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

const existingUser = new UsersModel(
  7,
  "Fred",
  "Nerk",
  "member",
  "fn@gym.com",
  "$2a$10$already-hashed",
  "555-0100",
  "1815-12-10",
  0,
  "auth-key",
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
  firstName: "Fred",
  lastName: "Nerk",
  role: "member",
  email: "fn@gym.com",
  password: "$2a$10$already-hashed",
  phone: "555-0100",
  dob: "1815-12-10",
  deleted: 0,
  updatedBy: 3,
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Mocked models isolate user-management responses from database behavior.
describe("UsersController unit tests", () => {
  test("renders users and the selected user", async () => {
    jest
      .spyOn(UsersModel, "list")
      .mockResolvedValue({ users: [existingUser], total: 1 });
    const res = response();

    UsersController.viewUserManagement(request({ id: "7" }), res);
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith(
      "user_management.ejs",
      expect.objectContaining({
        users: [existingUser],
        selectedUser: existingUser,
        role: "admin",
      }),
    );
  });

  test("logs user-list load errors", async () => {
    const error = new Error("database error");
    jest.spyOn(UsersModel, "list").mockRejectedValue(error);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    UsersController.viewUserManagement(request(), response());
    await flushPromises();

    expect(log).toHaveBeenCalledWith(error);
  });

  test("creates a user and redirects", async () => {
    const create = jest
      .spyOn(UsersModel, "create")
      .mockResolvedValue({ insertId: 7 });
    const res = response();

    UsersController.handleUserManagement(request({}, formData("create")), res);
    await flushPromises();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Fred",
        email: "fn@gym.com",
      }),
    );
    expect(res.redirect).toHaveBeenCalledWith("/users");
  });

  test("hashes an unencrypted password before creating", async () => {
    const create = jest
      .spyOn(UsersModel, "create")
      .mockResolvedValue({ insertId: 7 });
    const hash = jest
      .spyOn(bcrypt, "hashSync")
      .mockReturnValue("hashed-password");
    const res = response();

    UsersController.handleUserManagement(
      request({}, { ...formData("create"), password: "plain-text" }),
      res,
    );
    await flushPromises();

    expect(hash).toHaveBeenCalledWith("plain-text", 10);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ password: "hashed-password" }),
    );
  });

  test("updates a user when the database changes a row", async () => {
    const update = jest
      .spyOn(UsersModel, "update")
      .mockResolvedValue({ affectedRows: 1 });
    const res = response();

    UsersController.handleUserManagement(
      request({ id: "7" }, formData("update")),
      res,
    );
    await flushPromises();

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: "7" }));
    expect(res.redirect).toHaveBeenCalledWith("/users");
  });

  test("deletes a user and redirects when a row is deleted", async () => {
    const remove = jest
      .spyOn(UsersModel, "delete")
      .mockResolvedValue({ affectedRows: 1 });
    const res = response();

    UsersController.handleUserManagement(
      request({ id: "7" }, formData("delete")),
      res,
    );
    await flushPromises();

    expect(remove).toHaveBeenCalledWith("7");
    expect(res.redirect).toHaveBeenCalledWith("/users");
  });
});
