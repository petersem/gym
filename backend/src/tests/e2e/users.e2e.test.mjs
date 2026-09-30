import express from "express";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "@jest/globals";
import { UsersController } from "../../controllers/UsersController.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

const app = express();
let server;
let baseUrl;
let createdUserId;

app.use(express.urlencoded({ extended: true }));
app.use("/users", UsersController.routes);

beforeAll(async () => {
  server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (createdUserId) {
    await UsersModel.delete(createdUserId);
    createdUserId = undefined;
  }
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await UsersModel.connection.end();
});

const userForm = (action, email, overrides = {}) =>
  new URLSearchParams({
    action,
    firstName: "E2E",
    lastName: "Test User",
    role: "member",
    email,
    password: "E2E-password-123",
    phone: "555-0199",
    dob: "2000-01-01",
    deleted: "0",
    updatedBy: "1",
    ...overrides,
  });

const createUser = async (email) => {
  const response = await fetch(`${baseUrl}/users`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: userForm("create", email),
    redirect: "manual",
  });

  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/users");

  const users = await UsersModel.getBySearch(email);
  expect(users).toHaveLength(1);
  createdUserId = users[0].id;
  return users[0];
};

describe("UsersController end-to-end flow", () => {
  test("creates a user through HTTP", async () => {
    const email = `e2e-create-${Date.now()}@example.com`;
    const createdUser = await createUser(email);
    expect(createdUser.first_name).toBe("E2E");
  });

  test("updates a user through HTTP", async () => {
    const email = `e2e-update-${Date.now()}@example.com`;
    await createUser(email);

    const updateResponse = await fetch(`${baseUrl}/users/${createdUserId}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: userForm("update", email, { firstName: "Updated" }),
      redirect: "manual",
    });

    expect(updateResponse.status).toBe(302);
    expect((await UsersModel.getById(createdUserId)).first_name).toBe(
      "Updated",
    );
  });

  test("deletes a user through HTTP", async () => {
    const email = `e2e-delete-${Date.now()}@example.com`;
    await createUser(email);

    const deleteResponse = await fetch(`${baseUrl}/users/${createdUserId}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: userForm("delete", email),
      redirect: "manual",
    });

    expect(deleteResponse.status).toBe(302);
    await expect(UsersModel.getById(createdUserId)).rejects.toBe("not found");
    createdUserId = undefined;
  });
});
