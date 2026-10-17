import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import express from "express";
import bcrypt from "bcryptjs";
import SwaggerParser from "@apidevtools/swagger-parser";
import {
  APIController,
  authorizationIconsPlugin,
} from "../controllers/api/APIController.mjs";
import { swaggerSpec } from "../swagger.config.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { ActivitiesModel } from "../models/ActivitiesModel.mjs";
import { LocationModel } from "../models/LocationModel.mjs";
import { SessionsModel } from "../models/SessionsModel.mjs";
import { BookingsModel } from "../models/BookingsModel.mjs";
import { BlogModel } from "../models/BlogModel.mjs";
import { DatabaseModel } from "../models/DatabaseModel.mjs";

const key = (id) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`;
const models = {
  users: UsersModel,
  activities: ActivitiesModel,
  locations: LocationModel,
  sessions: SessionsModel,
  bookings: BookingsModel,
  blogs: BlogModel,
};
const removedMethods = {
  users: ["post", "delete"],
  sessions: ["post", "put"],
};
const bodies = {
  users: {
    first_name: "New",
    last_name: "Member",
    email: "new@example.com",
    password: "testing123",
    phone: "0412345678",
  },
  activities: { name: "Yoga", description: "Stretch and strengthen." },
  locations: {
    name: "City",
    phone: "0733334444",
    email: "city@example.com",
    street: "12 High Street",
    suburb: "Brisbane",
    postcode: 4000,
    manager: 1,
  },
  sessions: {
    title: "Morning yoga",
    activity_id: 1,
    location_id: 1,
    trainer_id: 2,
    date: "2099-12-01",
    time: "09:00",
  },
  bookings: { session_id: 1, user_id: 3 },
  blogs: { title: "News", content: "Welcome to the gym." },
};
let server;
let baseUrl;
let records;
let passwordHash;

async function request(
  path,
  { method = "GET", user, body, headers = {} } = {},
) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      ...(user ? { "x-auth-key": key(user) } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    body: await response.json(),
    location: response.headers.get("location"),
  };
}

beforeAll(async () => {
  passwordHash = await bcrypt.hash("testing123", 4);
  const app = express();
  app.use((req, _res, next) => {
    if (req.headers["x-test-cookie-session"]) {
      req.authenticatedUser = { id: 1, role: "admin" };
    }
    next();
  });
  app.use("/api/v1", APIController.routes);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  records = {
    users: ["admin", "trainer", "member", "member", "trainer"].map(
      (role, i) => ({
        ...bodies.users,
        id: i + 1,
        role,
        email: `user${i + 1}@example.com`,
        password: passwordHash,
        dob: null,
        deleted: 0,
        authentication_key: key(i + 1),
      }),
    ),
    activities: [{ ...bodies.activities, id: 1, deleted: 0, updated_by: 1 }],
    locations: [{ ...bodies.locations, id: 1, deleted: 0, updated_by: 1 }],
    sessions: [{ ...bodies.sessions, id: 1, time: "09:00:00" }],
    bookings: [
      {
        id: 1,
        session_id: 1,
        user_id: 3,
        created: "2026-10-16 09:00:00",
      },
    ],
    blogs: [
      {
        ...bodies.blogs,
        id: 1,
        user_id: 3,
        created: "2026-10-16 09:00:00",
      },
    ],
  };
  for (const [name, model] of Object.entries(models)) {
    jest
      .spyOn(model, "getAll")
      .mockImplementation(async () =>
        structuredClone(records[name].filter((record) => !record.deleted)),
      );
    jest.spyOn(model, "getById").mockImplementation(async (id) => {
      const record = records[name].find((item) => item.id === Number(id));
      if (!record) {
        throw "not found";
      }
      return { ...record };
    });
    jest.spyOn(model, "create").mockImplementation(async (record) => {
      records[name].push({ ...record, id: 100 });
      return { affectedRows: 1, insertId: 100 };
    });
    jest.spyOn(model, "update").mockImplementation(async (record) => {
      const index = records[name].findIndex((item) => item.id === record.id);
      if (index < 0) {
        return { affectedRows: 0 };
      }
      records[name][index] = { ...record };
      return { affectedRows: 1 };
    });
    jest.spyOn(model, "delete").mockImplementation(async (id) => {
      records[name] = records[name].filter((record) => record.id !== id);
      return { affectedRows: 1 };
    });
  }
  jest
    .spyOn(UsersModel, "getByAuthenticationKey")
    .mockImplementation(async (value) => {
      const user = records.users.find(
        (item) => item.authentication_key === value && !item.deleted,
      );
      if (!user) {
        throw "not found";
      }
      return { ...user };
    });
  jest
    .spyOn(UsersModel, "getByUsername")
    .mockImplementation(async (username) => {
      const user = records.users.find(
        (item) => item.email === username && !item.deleted,
      );
      if (!user) {
        throw "not found";
      }
      return structuredClone(user);
    });
  jest
    .spyOn(BookingsModel, "getByUserId")
    .mockImplementation(async (id) =>
      structuredClone(records.bookings.filter((item) => item.user_id === id)),
    );
  jest
    .spyOn(BookingsModel, "deleteBySessionId")
    .mockResolvedValue({ affectedRows: 1 });
});

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("OpenAPI contract", () => {
  test("removes List all users from the API and Swagger documentation", async () => {
    expect(swaggerSpec.paths).not.toHaveProperty("/api/v1/users");
    expect(swaggerSpec.paths["/api/v1/users/{id}"]).toHaveProperty("get");
    expect(swaggerSpec.paths["/api/v1/users/{id}"]).toHaveProperty("put");
    for (const user of [undefined, 2, 3]) {
      const response = await request("/users", { user });
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("message");
    }
    expect(UsersModel.getAll).not.toHaveBeenCalled();
  });

  test.each(Object.entries(removedMethods))(
    "removes unsupported %s writes from the contract and rejects direct requests",
    async (resource, methods) => {
      for (const method of methods) {
        const path = `/${resource}${method === "post" ? "" : "/1"}`;
        for (const user of [2, 3]) {
          const result = await request(path, {
            method: method.toUpperCase(),
            user,
            ...(method !== "delete" ? { body: bodies[resource] } : {}),
          });
          expect(result.status).toBe(
            resource === "users" && method === "post" ? 404 : 405,
          );
          expect(result.body).toHaveProperty("message");
        }
      }
      expect(models[resource].create).not.toHaveBeenCalled();
      expect(models[resource].update).not.toHaveBeenCalled();
      expect(models[resource].delete).not.toHaveBeenCalled();
    },
  );

  test.each(["authorizeOperationBtn"])(
    "reverses only the padlock presentation for %s",
    (component) => {
      const createElement = jest.fn((type, props) => ({ type, props }));
      const original = () => null;
      const wrapped = authorizationIconsPlugin().wrapComponents[component](
        original,
        { React: { createElement } },
      );
      const onClick = jest.fn();
      for (const isAuthorized of [false, true, false]) {
        const props = { isAuthorized, onClick, showPopup: true };
        expect(wrapped(props)).toEqual({
          type: original,
          props: { ...props, isAuthorized: !isAuthorized },
        });
        expect(props.isAuthorized).toBe(isAuthorized);
      }
      expect(onClick).not.toHaveBeenCalled();
    },
  );

  test("labels the main button Log Out only while authorized", () => {
    const createElement = (type, props, ...children) => ({
      type,
      props,
      children,
    });
    const getComponent = (name) => name;
    const onClick = jest.fn();
    const wrapped = authorizationIconsPlugin().wrapComponents.authorizeBtn(
      () => null,
      { React: { createElement } },
    );
    for (const isAuthorized of [false, true, false]) {
      const rendered = wrapped({
        isAuthorized,
        getComponent,
        onClick,
        showPopup: true,
      });
      const [button, popup] = rendered.children;
      expect(button.children[0].children).toEqual([
        isAuthorized ? "Log Out" : "Authorize",
      ]);
      expect(button.children[1].type).toBe(
        isAuthorized ? "UnlockAuthIcon" : "LockAuthIcon",
      );
      expect(button.props.onClick).toBe(onClick);
      expect(popup.type).toBe("authorizationPopup");
    }
    expect(
      wrapped({ isAuthorized: false, getComponent, onClick, showPopup: false })
        .children[1],
    ).toBeNull();
    expect(onClick).not.toHaveBeenCalled();
  });

  test("loads the padlock plugin in Swagger UI", async () => {
    const response = await fetch(`${baseUrl}/api/v1/docs/swagger-ui-init.js`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      authorizationIconsPlugin.toString(),
    );
  });

  test("returns JSON errors for malformed JSON bodies", async () => {
    const response = await fetch(`${baseUrl}/api/v1/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"username":',
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toHaveProperty("message");
    expect(UsersModel.getByUsername).not.toHaveBeenCalled();
  });
  test("contains valid gym schemas and only the retained operations", async () => {
    await SwaggerParser.validate(structuredClone(swaggerSpec));
    expect(swaggerSpec.tags.map((tag) => tag.name)).not.toEqual(
      expect.arrayContaining(["Activities", "Locations"]),
    );
    expect(
      Object.keys(swaggerSpec.paths).every((path) =>
        path.startsWith("/api/v1/"),
      ),
    ).toBe(true);
    for (const resource of Object.keys(models)) {
      if (["activities", "locations"].includes(resource)) {
        expect(swaggerSpec.paths).not.toHaveProperty(`/api/v1/${resource}`);
        expect(swaggerSpec.paths).not.toHaveProperty(
          `/api/v1/${resource}/{id}`,
        );
        continue;
      }
      if (resource === "users") {
        expect(swaggerSpec.paths).not.toHaveProperty("/api/v1/users");
        expect(swaggerSpec.paths["/api/v1/users/{id}"]).toHaveProperty("get");
        expect(swaggerSpec.paths["/api/v1/users/{id}"]).toHaveProperty("put");
        continue;
      }
      for (const method of ["get", "post", "put", "delete"]) {
        const path = `/api/v1/${resource}${["get", "post"].includes(method) ? "" : "/{id}"}`;
        if (removedMethods[resource]?.includes(method)) {
          expect(swaggerSpec.paths[path]).not.toHaveProperty(method);
        } else {
          expect(swaggerSpec.paths[path]).toHaveProperty(method);
        }
      }
    }
    expect(Object.keys(swaggerSpec.components.schemas)).not.toEqual(
      expect.arrayContaining(["Product", "Sale", "Order"]),
    );
    const spec = await request("/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.info.version).toBe(swaggerSpec.info.version);
  });

  test.each(Object.keys(models))(
    "denies every admin operation for %s, including public blog reads",
    async (resource) => {
      for (const [method, path] of [
        ["GET", `/${resource}`],
        ["GET", `/${resource}/1`],
        ["POST", `/${resource}`],
        ["PUT", `/${resource}/1`],
        ["DELETE", `/${resource}/1`],
      ]) {
        expect(
          (
            await request(path, {
              method,
              user: 1,
              ...(["POST", "PUT"].includes(method)
                ? { body: bodies[resource] }
                : {}),
            })
          ).status,
        ).toBe(403);
      }
      expect(models[resource].getAll).not.toHaveBeenCalled();
      expect(models[resource].getById).not.toHaveBeenCalled();
      expect(models[resource].create).not.toHaveBeenCalled();
      expect(models[resource].update).not.toHaveBeenCalled();
      expect(models[resource].delete).not.toHaveBeenCalled();
    },
  );

  test.each(["0", "-1", "abc", "1.5", "2147483648"])(
    "rejects invalid resource ID %s",
    async (id) => {
      expect((await request(`/blogs/${id}`, { user: 3 })).status).toBe(400);
      expect(BlogModel.getById).not.toHaveBeenCalled();
    },
  );

  test.each(["bookings", "blogs"])(
    "rejects missing fields and unknown fields for %s",
    async (resource) => {
      expect(
        (await request(`/${resource}`, { method: "POST", user: 3, body: {} }))
          .status,
      ).toBe(400);
      expect(
        (
          await request(`/${resource}`, {
            method: "POST",
            user: 3,
            body: { ...bodies[resource], unexpected: true },
          })
        ).status,
      ).toBe(400);
      expect(models[resource].create).not.toHaveBeenCalled();
    },
  );

  test.each([
    ["users", { role: "sales" }],
    ["users", { password: "short" }],
    ["users", { phone: "123" }],
    ["users", { dob: "2026-02-30" }],
    ["blogs", { content: "x".repeat(251) }],
    ["bookings", { user_id: 0 }],
  ])("validates %s fields: %j", async (resource, changes) => {
    const result = await request(
      `/${resource}${resource === "users" ? "/3" : ""}`,
      {
        method: resource === "users" ? "PUT" : "POST",
        user: 3,
        body: { ...bodies[resource], ...changes },
      },
    );
    expect(result.status).toBe(400);
    expect(models[resource].create).not.toHaveBeenCalled();
    expect(models[resource].update).not.toHaveBeenCalled();
  });
});

describe("API authentication and access", () => {
  test.each([2, 3])(
    "returns a schema-valid own profile by ID and key for user %s",
    async (user) => {
      for (const path of [`/users/${user}`, "/user/self"]) {
        const result = await request(path, { user });
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
          id: user,
          first_name: records.users[user - 1].first_name,
          last_name: records.users[user - 1].last_name,
          role: user === 2 ? "trainer" : "member",
          email: records.users[user - 1].email,
          phone: records.users[user - 1].phone,
          dob: null,
        });
      }
      expect(swaggerSpec.components.schemas.User.properties.role.readOnly).toBe(
        true,
      );
      expect(
        swaggerSpec.components.schemas.UserUpdate.properties,
      ).not.toHaveProperty("role");
    },
  );

  test("rejects admin login without issuing or rotating a key", async () => {
    const result = await request("/authenticate", {
      method: "POST",
      body: { username: "user1@example.com", password: "testing123" },
    });
    expect(result.status).toBe(403);
    expect(result.body.message).toBe("This role has no API access.");
    expect(UsersModel.update).not.toHaveBeenCalled();
    expect(records.users[0].authentication_key).toBe(key(1));
    for (const path of ["/user/self", "/timetable", "/authenticate"]) {
      expect(
        (
          await request(path, {
            user: 1,
            method: path === "/authenticate" ? "DELETE" : "GET",
          })
        ).status,
      ).toBe(403);
    }
  });

  test.each([3])(
    "allows user %s to log in and read only their own bookings",
    async (user) => {
      records.bookings.push({ ...records.bookings[0], id: 2, user_id: 2 });
      const list = await request("/bookings", { user });
      expect(list.status).toBe(200);
      expect(list.body.map((record) => record.user_id)).toEqual([user]);
      const ownId = user === 2 ? 2 : 1;
      const otherId = user === 2 ? 1 : 2;
      expect((await request(`/bookings/${ownId}`, { user })).status).toBe(200);
      expect((await request(`/bookings/${otherId}`, { user })).status).toBe(
        403,
      );
      expect((await request("/sessions", { user })).status).toBe(200);
      expect((await request("/sessions/1", { user })).status).toBe(200);
      const login = await request("/authenticate", {
        method: "POST",
        body: { username: `user${user}@example.com`, password: "testing123" },
      });
      expect(login.status).toBe(200);
      expect(
        (
          await request("/user/self", {
            headers: { "x-auth-key": login.body.key },
          })
        ).status,
      ).toBe(200);
    },
  );

  test("trainers can only read bookings linked to sessions assigned to them", async () => {
    records.sessions.push({ ...records.sessions[0], id: 2, trainer_id: 5 });
    records.bookings.push(
      { ...records.bookings[0], id: 2, session_id: 2, user_id: 2 },
      { ...records.bookings[0], id: 3, session_id: 1, user_id: 4 },
      { ...records.bookings[0], id: 4, session_id: 999, user_id: 2 },
    );
    const list = await request("/bookings", { user: 2 });
    expect(list.status).toBe(200);
    expect(list.body.map((booking) => booking.id)).toEqual([1, 3]);
    expect(BookingsModel.getByUserId).not.toHaveBeenCalled();
    expect((await request("/bookings/1", { user: 2 })).status).toBe(200);
    expect((await request("/bookings/3", { user: 2 })).status).toBe(200);
    expect((await request("/bookings/2", { user: 2 })).status).toBe(403);
    expect((await request("/bookings/4", { user: 2 })).status).toBe(404);
    const otherTrainer = await request("/bookings", { user: 5 });
    expect(otherTrainer.body.map((booking) => booking.id)).toEqual([2]);
    records.sessions[1].trainer_id = 2;
    expect((await request("/bookings/2", { user: 2 })).status).toBe(200);
    expect((await request("/bookings", { user: 5 })).body).toEqual([]);
    expect((await request("/bookings/2", { user: 5 })).status).toBe(403);
  });

  test("blocks trainers from all booking writes, even for their own bookings", async () => {
    records.bookings[0].user_id = 2;
    for (const [method, path] of [
      ["POST", "/bookings"],
      ["PUT", "/bookings/1"],
      ["DELETE", "/bookings/1"],
    ]) {
      expect(
        (
          await request(path, {
            method,
            user: 2,
            ...(method !== "DELETE" ? { body: { session_id: 1 } } : {}),
          })
        ).status,
      ).toBe(403);
    }
    expect(BookingsModel.create).not.toHaveBeenCalled();
    expect(BookingsModel.update).not.toHaveBeenCalled();
    expect(BookingsModel.delete).not.toHaveBeenCalled();
  });

  test.each([2, 3])(
    "limits profile access and updates to user %s without role escalation",
    async (user) => {
      const { first_name, last_name, email, phone } = records.users[user - 1];
      const body = { first_name, last_name, email, phone };
      records.users[user - 1].dob = new Date(1990, 4, 12);
      expect((await request(`/users/${user}`, { user })).status).toBe(200);
      const updated = await request(`/users/${user}`, {
        method: "PUT",
        user,
        body: { ...body, first_name: "Updated" },
      });
      expect(updated.status).toBe(200);
      expect(updated.body.first_name).toBe("Updated");
      expect(updated.body.dob).toBe("1990-05-12");
      expect(records.users[user - 1].role).toBe(
        user === 2 ? "trainer" : "member",
      );
      expect(records.users[user - 1].authentication_key).toBe(key(user));
      UsersModel.update.mockClear();
      for (const role of ["admin", user === 2 ? "member" : "trainer"]) {
        expect(
          (
            await request(`/users/${user}`, {
              method: "PUT",
              user,
              body: { ...body, role },
            })
          ).status,
        ).toBe(400);
      }
      for (const method of ["GET", "PUT", "DELETE"]) {
        expect(
          (
            await request("/users/4", {
              method,
              user,
              ...(method === "PUT" ? { body } : {}),
            })
          ).status,
        ).toBe(method === "DELETE" ? 405 : 403);
      }
      for (const [method, path] of [
        ["GET", "/users"],
        ["POST", "/users"],
        ["DELETE", `/users/${user}`],
      ]) {
        expect(
          (
            await request(path, {
              method,
              user,
              ...(method === "POST" ? { body: bodies.users } : {}),
            })
          ).status,
        ).toBe(method === "DELETE" ? 405 : 404);
      }
      expect(UsersModel.create).not.toHaveBeenCalled();
      expect(UsersModel.update).not.toHaveBeenCalled();
      expect(UsersModel.delete).not.toHaveBeenCalled();
    },
  );

  test.each([2, 3])(
    "keeps user %s authenticated after invalid own-profile updates",
    async (user) => {
      const { first_name, last_name, email, phone } = records.users[user - 1];
      const body = { first_name, last_name, email, phone };
      for (const changes of [
        { email: "invalid" },
        { phone: "123" },
        { password: "short" },
      ]) {
        expect(
          (
            await request(`/users/${user}`, {
              method: "PUT",
              user,
              body: { ...body, ...changes },
            })
          ).status,
        ).toBe(400);
        expect((await request("/user/self", { user })).status).toBe(200);
      }
      expect(UsersModel.update).not.toHaveBeenCalled();
    },
  );

  test.each(Object.keys(models))(
    "requires authentication for every %s write",
    async (resource) => {
      const body = { ...bodies[resource] };
      if (resource === "users") {
        delete body.role;
      }
      for (const [method, path] of [
        ["POST", `/${resource}`],
        ["PUT", `/${resource}/1`],
        ["DELETE", `/${resource}/1`],
      ]) {
        const result = await request(path, {
          method,
          ...(["POST", "PUT"].includes(method) ? { body } : {}),
        });
        expect(result.status).toBe(
          ["activities", "locations"].includes(resource) ||
            (resource === "users" && method === "POST")
            ? 404
            : removedMethods[resource]?.includes(method.toLowerCase())
              ? 405
              : 401,
        );
      }
      expect(models[resource].create).not.toHaveBeenCalled();
      expect(models[resource].update).not.toHaveBeenCalled();
      expect(models[resource].delete).not.toHaveBeenCalled();
    },
  );
  test.each([
    ["activities", 2],
    ["activities", 3],
    ["locations", 2],
    ["locations", 3],
  ])("removes every %s operation (user %s)", async (resource, user) => {
    for (const [method, path] of [
      ["GET", `/${resource}`],
      ["GET", `/${resource}/1`],
      ["POST", `/${resource}`],
      ["PUT", `/${resource}/1`],
      ["DELETE", `/${resource}/1`],
    ]) {
      const result = await request(path, {
        method,
        user,
        ...(["POST", "PUT"].includes(method) ? { body: bodies[resource] } : {}),
      });
      expect(result.status).toBe(404);
    }
    for (const method of ["getAll", "getById", "create", "update", "delete"]) {
      expect(models[resource][method]).not.toHaveBeenCalled();
    }
  });

  test("rejects missing/invalid API keys and does not reuse browser sessions", async () => {
    expect((await request("/users")).status).toBe(404);
    expect(
      (await request("/users", { headers: { "x-test-cookie-session": "yes" } }))
        .status,
    ).toBe(404);
    expect(
      (await request("/user/self", { headers: { "x-auth-key": "invalid" } }))
        .status,
    ).toBe(401);
    expect((await request("/user/self", { user: 99 })).status).toBe(401);
  });

  test("guests can only read blogs, not profiles, bookings or sessions", async () => {
    for (const path of [
      "/user/self",
      "/users",
      "/users/3",
      "/bookings",
      "/bookings/1",
      "/sessions",
      "/sessions/1",
      "/timetable",
      "/activities",
      "/locations",
    ]) {
      expect((await request(path)).status).toBe(
        ["/users", "/activities", "/locations"].includes(path) ? 404 : 401,
      );
    }
    expect((await request("/blogs")).status).toBe(200);
    expect((await request("/blogs/1")).status).toBe(200);
  });

  test("logs in, rotates the key and logs out", async () => {
    const login = await request("/authenticate", {
      method: "POST",
      body: { username: "user3@example.com", password: "testing123" },
    });
    expect(login.status).toBe(200);
    expect(login.body.key).toMatch(/^[0-9a-f-]{36}$/);
    expect((await request("/user/self", { user: 3 })).status).toBe(401);
    const headers = { "x-auth-key": login.body.key };
    const profile = await request("/user/self", { headers });
    expect(profile.status).toBe(200);
    expect(profile.body.id).toBe(3);
    expect(profile.body).not.toHaveProperty("password");
    expect(profile.body).not.toHaveProperty("authentication_key");
    expect(
      (await request("/authenticate", { method: "DELETE", headers })).status,
    ).toBe(200);
    expect((await request("/user/self", { headers })).status).toBe(401);
    expect((await request("/authenticate", { method: "DELETE" })).status).toBe(
      401,
    );
  });

  test.each([
    { username: "user3@example.com", password: "wrong" },
    { username: "unknown@example.com", password: "testing123" },
  ])("rejects invalid credentials without issuing a key: %j", async (body) => {
    const result = await request("/authenticate", { method: "POST", body });
    expect(result.status).toBe(400);
    expect(result.body.message).toBe("Invalid credentials");
    expect(UsersModel.update).not.toHaveBeenCalled();
  });

  test("reports and logs database failures without leaking details", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    UsersModel.getByAuthenticationKey.mockRejectedValue(
      new Error("private database details"),
    );
    const result = await request("/users", { user: 1 });
    expect(result.status).toBe(500);
    expect(result.body.message).not.toContain("private");
    expect(log).toHaveBeenCalled();
  });
});

describe("ownership and gym rules", () => {
  test.each(["+61 4 1234 5678", "(07) 3333 4444", "1300 123 456"])(
    "accepts Australian phone formatting used by the app: %s",
    async (phone) => {
      expect(
        (
          await request("/users/3", {
            method: "PUT",
            user: 3,
            body: { ...bodies.users, phone },
          })
        ).status,
      ).toBe(200);
    },
  );

  test("rejects invalid model responses instead of silently sending success", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    BlogModel.getAll.mockResolvedValue([{ id: 1 }]);
    const result = await request("/blogs");
    expect(result.status).toBe(500);
    expect(result.body.message).toBe("Unable to process the API request.");
  });

  test("serializes database timestamps as RFC 3339", async () => {
    const result = await request("/bookings/1", { user: 3 });
    expect(result.status).toBe(200);
    expect(result.body.created).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  test("blocks trainers from creating sessions but allows authoring blog posts", async () => {
    expect(
      (
        await request("/sessions", {
          method: "POST",
          user: 2,
          body: bodies.sessions,
        })
      ).status,
    ).toBe(405);
    expect(SessionsModel.create).not.toHaveBeenCalled();
    const blog = await request("/blogs", {
      method: "POST",
      user: 2,
      body: bodies.blogs,
    });
    expect(blog.status).toBe(201);
    expect(blog.body.user_id).toBe(2);
  });
  test("hashes new passwords, preserves omitted, empty or unchanged ones, and never returns hashes or keys", async () => {
    const body = { ...bodies.users };
    delete body.password;
    const updated = await request("/users/3", {
      method: "PUT",
      user: 3,
      body,
    });
    expect(updated.status).toBe(200);
    expect(records.users[2].password).toBe(passwordHash);
    expect(records.users[2].authentication_key).toBe(key(3));
    expect(updated.body).not.toHaveProperty("password");
    expect(updated.body).not.toHaveProperty("authentication_key");
    expect((await request("/user/self", { user: 3 })).status).toBe(200);
    const empty = await request("/users/3", {
      method: "PUT",
      user: 3,
      body: { ...body, first_name: "Empty password update", password: "" },
    });
    expect(empty.status).toBe(200);
    expect(empty.body.first_name).toBe("Empty password update");
    expect(records.users[2].password).toBe(passwordHash);
    expect(records.users[2].authentication_key).toBe(key(3));
    expect((await request("/user/self", { user: 3 })).status).toBe(200);
    const unchanged = await request("/users/3", {
      method: "PUT",
      user: 3,
      body: { ...body, first_name: "Updated", password: "testing123" },
    });
    expect(unchanged.status).toBe(200);
    expect(unchanged.body.first_name).toBe("Updated");
    expect(records.users[2].password).toBe(passwordHash);
    expect(records.users[2].authentication_key).toBe(key(3));
    expect((await request("/user/self", { user: 3 })).status).toBe(200);
    const changed = await request("/users/3", {
      method: "PUT",
      user: 3,
      body: { ...body, password: "newpassword123" },
    });
    expect(changed.status).toBe(200);
    expect(
      await bcrypt.compare("newpassword123", records.users[2].password),
    ).toBe(true);
    expect(records.users[2].authentication_key).toBeNull();
    expect((await request("/user/self", { user: 3 })).status).toBe(401);
  });

  test("rejects overlong UTF-8 passwords before writing", async () => {
    expect(
      (
        await request("/users/3", {
          method: "PUT",
          user: 3,
          body: { ...bodies.users, password: "\u00e9".repeat(20) },
        })
      ).status,
    ).toBe(400);
    expect(UsersModel.update).not.toHaveBeenCalled();
  });

  test("hides soft-deleted records and validates active foreign keys", async () => {
    records.users[3].deleted = 1;
    expect((await request("/users/4", { user: 3 })).status).toBe(404);
    expect(
      (
        await request("/bookings", {
          method: "POST",
          user: 3,
          body: { session_id: 999 },
        })
      ).status,
    ).toBe(404);
    expect(BookingsModel.create).not.toHaveBeenCalled();
  });

  test("rejects spoofed server-managed fields", async () => {
    expect(
      (
        await request("/blogs", {
          method: "POST",
          user: 3,
          body: { ...bodies.blogs, user_id: 5 },
        })
      ).status,
    ).toBe(400);
  });

  test("scopes trainer sessions and prevents reassignment", async () => {
    records.sessions.push({ ...records.sessions[0], id: 2, trainer_id: 5 });
    const list = await request("/sessions", { user: 2 });
    expect(list.body.map((item) => item.id)).toEqual([1, 2]);
    expect((await request("/sessions/2", { user: 2 })).status).toBe(200);
    for (const method of ["PUT", "DELETE"]) {
      const result = await request("/sessions/2", {
        method,
        user: 2,
        ...(method === "PUT" ? { body: bodies.sessions } : {}),
      });
      expect(result.status).toBe(method === "PUT" ? 405 : 403);
    }
    const otherTrainer = { ...bodies.sessions, trainer_id: 5 };
    expect(
      (
        await request("/sessions", {
          method: "POST",
          user: 2,
          body: otherTrainer,
        })
      ).status,
    ).toBe(405);
    expect(
      (
        await request("/sessions/1", {
          method: "PUT",
          user: 2,
          body: otherTrainer,
        })
      ).status,
    ).toBe(405);
    expect(
      (
        await request("/sessions/1", {
          method: "PUT",
          user: 2,
          body: bodies.sessions,
        })
      ).status,
    ).toBe(405);
    expect(SessionsModel.update).not.toHaveBeenCalled();
  });

  test("blocks members from creating, updating and deleting sessions", async () => {
    expect(
      (
        await request("/sessions", {
          method: "POST",
          user: 3,
          body: { ...bodies.sessions, date: "2000-01-01" },
        })
      ).status,
    ).toBe(405);
    expect(
      (
        await request("/sessions", {
          method: "POST",
          user: 3,
          body: { ...bodies.sessions, trainer_id: 3 },
        })
      ).status,
    ).toBe(405);
    expect(
      (await request("/sessions/1", { method: "DELETE", user: 3 })).status,
    ).toBe(403);
    expect(
      (
        await request("/sessions/1", {
          method: "PUT",
          user: 3,
          body: bodies.sessions,
        })
      ).status,
    ).toBe(405);
    expect(SessionsModel.create).not.toHaveBeenCalled();
  });

  test("deletes associated bookings before deleting a session", async () => {
    const result = await request("/sessions/1", { method: "DELETE", user: 2 });
    expect(result.status).toBe(200);
    expect(BookingsModel.deleteBySessionId).toHaveBeenCalledWith(1);
    expect(
      BookingsModel.deleteBySessionId.mock.invocationCallOrder[0],
    ).toBeLessThan(SessionsModel.delete.mock.invocationCallOrder[0]);
  });

  test("scopes member bookings and blocks reading or changing another member's booking", async () => {
    records.bookings.push({ ...records.bookings[0], id: 2, user_id: 4 });
    expect(
      (await request("/bookings", { user: 3 })).body.map((item) => item.id),
    ).toEqual([1]);
    for (const method of ["GET", "PUT", "DELETE"]) {
      expect(
        (
          await request("/bookings/2", {
            method,
            user: 3,
            ...(method === "PUT" ? { body: bodies.bookings } : {}),
          })
        ).status,
      ).toBe(403);
    }
    expect(
      (
        await request("/bookings", {
          method: "POST",
          user: 3,
          body: { session_id: 1, user_id: 4 },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/bookings/1", {
          method: "PUT",
          user: 3,
          body: { session_id: 1, user_id: 4 },
        })
      ).status,
    ).toBe(403);
    expect(BookingsModel.update).not.toHaveBeenCalled();
  });

  test("lets members create and cancel their own bookings, but not update them", async () => {
    expect(
      (
        await request("/bookings", {
          method: "POST",
          user: 3,
          body: { session_id: 1 },
        })
      ).status,
    ).toBe(201);
    expect(BookingsModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 3 }),
    );
    const result = await request("/bookings/100", {
      method: "PUT",
      user: 3,
      body: { session_id: 1 },
    });
    expect(result.status).toBe(403);
    expect(BookingsModel.update).not.toHaveBeenCalled();
    expect(
      (await request("/bookings/100", { method: "DELETE", user: 3 })).status,
    ).toBe(200);
  });

  test("validates booking member roles and dates", async () => {
    expect(
      (
        await request("/bookings", {
          method: "POST",
          user: 3,
          body: { session_id: 1, user_id: 2 },
        })
      ).status,
    ).toBe(403);
    records.sessions[0].date = "2000-01-01";
    expect(
      (
        await request("/bookings", {
          method: "POST",
          user: 3,
          body: bodies.bookings,
        })
      ).status,
    ).toBe(400);
    expect(BookingsModel.create).not.toHaveBeenCalled();
  });

  test.each([
    ["bookings", { duplicate: true }],
    ["bookings", { overlap: true }],
  ])(
    "returns scheduling conflicts from %s creation",
    async (resource, conflict) => {
      models[resource].create.mockResolvedValue({
        affectedRows: 0,
        ...conflict,
      });
      models[resource].update.mockResolvedValue({
        affectedRows: 0,
        ...conflict,
      });
      for (const method of ["POST"]) {
        const path = `/${resource}${method === "PUT" ? "/1" : ""}`;
        expect(
          (await request(path, { method, user: 3, body: bodies[resource] }))
            .status,
        ).toBe(409);
      }
    },
  );

  test.each([2, 3])(
    "supports public blog reads and ownership-checked writes for user %s",
    async (user) => {
      expect((await request("/blogs")).status).toBe(200);
      expect((await request("/blogs/1")).status).toBe(200);
      expect(
        (await request("/blogs", { method: "POST", body: bodies.blogs }))
          .status,
      ).toBe(401);
      for (const method of ["PUT", "DELETE"]) {
        expect(
          (
            await request("/blogs/1", {
              method,
              user: 4,
              ...(method === "PUT" ? { body: bodies.blogs } : {}),
            })
          ).status,
        ).toBe(403);
      }
      expect(
        (
          await request("/blogs", {
            method: "POST",
            user,
            body: { ...bodies.blogs, user_id: 4 },
          })
        ).status,
      ).toBe(400);
      const created = await request("/blogs", {
        method: "POST",
        user,
        body: bodies.blogs,
      });
      expect(created.status).toBe(201);
      expect(created.body.user_id).toBe(user);
      const updated = await request("/blogs/100", {
        method: "PUT",
        user,
        body: bodies.blogs,
      });
      expect(updated.status).toBe(200);
      expect(updated.body.created).toBe(created.body.created);
      expect(
        (await request("/blogs/100", { method: "DELETE", user })).status,
      ).toBe(200);
    },
  );

  test("maps database conflicts and returns JSON errors for missing routes", async () => {
    BlogModel.create.mockRejectedValue(
      Object.assign(new Error("SQL detail"), { code: "ER_DUP_ENTRY" }),
    );
    expect(
      (
        await request("/blogs", {
          method: "POST",
          user: 3,
          body: bodies.blogs,
        })
      ).status,
    ).toBe(409);
    expect((await request("/blogs/999", { user: 3 })).status).toBe(404);
    const result = await request("/missing");
    expect(result.status).toBe(404);
    expect(result.body.message).toBeTruthy();
  });

  test("timetable filters the next seven days for members and trainers only", async () => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    records.sessions = [
      { ...records.sessions[0], id: 1, date: DatabaseModel.toMySqlDate(today) },
      {
        ...records.sessions[0],
        id: 2,
        date: DatabaseModel.toMySqlDate(today),
        location_id: 2,
      },
      { ...records.sessions[0], id: 3, date: DatabaseModel.toMySqlDate(end) },
    ];
    expect(
      (
        await request("/timetable?location_id=1&trainer_id=2", { user: 2 })
      ).body.map((item) => item.id),
    ).toEqual([1]);
    expect((await request("/timetable", { user: 3 })).body).toHaveLength(2);
    expect((await request("/timetable", { user: 1 })).status).toBe(403);
    expect((await request("/timetable", { user: 2 })).body).toHaveLength(2);
    expect((await request("/timetable")).status).toBe(401);
    expect(
      (await request("/timetable?location_id=invalid", { user: 2 })).status,
    ).toBe(400);
  });
});
