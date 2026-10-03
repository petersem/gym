import express from "express";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { UsersController } from "../../controllers/UsersController.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

const requestCount = 50;
const app = express();
let server;
let baseUrl;
const createdUserIds = [];

app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.authenticatedUser = { id: 1, role: "admin" };
  next();
});
app.use("/users", UsersController.routes);

beforeAll(async () => {
  server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await Promise.all(createdUserIds.map((id) => UsersModel.delete(id)));
  await UsersModel.query("DELETE FROM users WHERE email LIKE ?", [
    "controller-load-%",
  ]);
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await UsersModel.connection.end();
});

const userForm = (email) =>
  new URLSearchParams({
    action: "create",
    firstName: "Load",
    lastName: "Test User",
    role: "member",
    email,
    password: "Load-test-password-123",
    phone: "0412 345 678",
    dob: "2000-01-01",
    deleted: "0",
    updatedBy: "1",
  });

// Sends concurrent HTTP creates through the real route using test-only admin auth.
describe("UsersController load test", () => {
  test(`handles ${requestCount} concurrent user creations`, async () => {
    const startedAt = performance.now();
    const responses = await Promise.all(
      Array.from({ length: requestCount }, (_, index) => {
        const email = `controller-load-${Date.now()}-${index}@example.com`;
        return fetch(`${baseUrl}/users`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: userForm(email),
          redirect: "manual",
        }).then(async (response) => ({
          email,
          status: response.status,
          location: response.headers.get("location"),
          body: await response.text(),
        }));
      }),
    );
    const durationMs = performance.now() - startedAt;
    const requestsPerSecond = (requestCount / durationMs) * 1000;

    expect(requestsPerSecond).toBeGreaterThan(0);
    expect(responses).toHaveLength(requestCount);
    expect(responses.filter((response) => response.status !== 302)).toEqual([]);
    expect(responses.map((response) => response.location)).toEqual(
      Array(requestCount).fill("/users"),
    );

    for (const response of responses) {
      const users = await UsersModel.getBySearch(response.email);
      expect(users).toHaveLength(1);
      createdUserIds.push(users[0].id);
    }
  });
});
