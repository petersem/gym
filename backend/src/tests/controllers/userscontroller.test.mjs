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

  test("passes valid role, sorting, and pagination filters to the model", async () => {
    const list = jest
      .spyOn(UsersModel, "list")
      .mockResolvedValue({ users: [], total: 0 });
    const res = response();

    UsersController.viewUserManagement(
      {
        params: {},
        query: {
          search_term: "Fred",
          role: "trainer",
          sort_by: "email",
          sort_dir: "desc",
          page: "2",
        },
      },
      res,
    );
    await flushPromises();

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        searchTerm: "Fred",
        role: "trainer",
        sortBy: "email",
        sortDir: "desc",
        page: 2,
      }),
    );
    expect(res.render.mock.calls[0][1].selectedRole).toBe("trainer");
  });

  test("logs user-list load errors", async () => {
    const error = new Error("database error");
    jest.spyOn(UsersModel, "list").mockRejectedValue(error);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    UsersController.viewUserManagement(request(), response());
    await flushPromises();

    expect(log).toHaveBeenCalledWith(error);
  });

  test("loads an off-page user and falls back when it is missing", async () => {
    jest.spyOn(UsersModel, "list").mockResolvedValue({ users: [], total: 0 });
    const getById = jest
      .spyOn(UsersModel, "getById")
      .mockResolvedValueOnce(existingUser)
      .mockRejectedValueOnce("not found");
    const res = response();

    UsersController.viewUserManagement(request({ id: "7" }), res);
    await flushPromises();
    UsersController.viewUserManagement(request({ id: "999" }), res);
    await flushPromises();

    expect(getById).toHaveBeenCalledWith("7");
    expect(res.render.mock.calls[0][1].selectedUser).toBe(existingUser);
    expect(res.render.mock.calls[1][1].selectedUser).toMatchObject({
      id: null,
    });
  });

  test("renders a complete empty user when no user is selected", async () => {
    jest.spyOn(UsersModel, "list").mockResolvedValue({ users: [], total: 0 });
    const res = response();

    UsersController.viewUserManagement(request({}), res);
    await flushPromises();

    const renderedUser = res.render.mock.calls[0][1].selectedUser;
    expect(renderedUser).toBeInstanceOf(UsersModel);
    expect(renderedUser).toMatchObject({
      id: null,
      first_name: "",
      last_name: "",
      email: "",
      deleted: 0,
      authentication_key: 0,
    });
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

  test("renders create database errors", async () => {
    jest
      .spyOn(UsersModel, "create")
      .mockRejectedValue(new Error("database error"));
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = response();

    UsersController.handleUserManagement(request({}, formData("create")), res);
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith(
      "status.ejs",
      expect.objectContaining({ status: "Database Error" }),
    );
    expect(errorLog).toHaveBeenCalled();
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

  test("renders an update failure when no row changes", async () => {
    jest.spyOn(UsersModel, "update").mockResolvedValue({ affectedRows: 0 });
    const res = response();

    UsersController.handleUserManagement(
      request({ id: "7" }, formData("update")),
      res,
    );
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith("status.ejs", {
      status: "User Update Failed",
      message: "The user could not be found.",
    });
  });

  test("renders update database errors", async () => {
    jest
      .spyOn(UsersModel, "update")
      .mockRejectedValue(new Error("database error"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = response();

    UsersController.handleUserManagement(
      request({ id: "7" }, formData("update")),
      res,
    );
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith(
      "status.ejs",
      expect.objectContaining({ status: "Database Error" }),
    );
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

  test("renders a deletion failure when no row is deleted", async () => {
    jest.spyOn(UsersModel, "delete").mockResolvedValue({ affectedRows: 0 });
    const res = response();

    UsersController.handleUserManagement(
      request({ id: "7" }, formData("delete")),
      res,
    );
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith("status.ejs", {
      status: "User Deletion Failed",
      message: "The user could not be found.",
    });
  });

  test("renders deletion database errors", async () => {
    jest
      .spyOn(UsersModel, "delete")
      .mockRejectedValue(new Error("database error"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = response();

    UsersController.handleUserManagement(
      request({ id: "7" }, formData("delete")),
      res,
    );
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith(
      "status.ejs",
      expect.objectContaining({ status: "Database Error" }),
    );
  });

  test("renders an invalid action error", () => {
    const res = response();

    UsersController.handleUserManagement(request({}, formData("unknown")), res);

    expect(res.render).toHaveBeenCalledWith("status.ejs", {
      status: "Invalid Action",
      message: "The form doesn't support this action.",
    });
  });
});
