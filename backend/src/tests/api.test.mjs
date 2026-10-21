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
  locations: ["post", "put", "delete"],
  sessions: ["post", "get", "put"],
};
const removedBasePaths = ["users", "sessions"];
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

describe("user PATCH", () => {
  test.each(["blogs", "bookings", "locations", "sessions"])(
    "rejects unsupported PATCH requests for %s",
    async (resource) => {
      const result = await request(`/${resource}/1`, {
        method: "PATCH",
        user: 3,
        body: { first_name: "Unsupported" },
      });
      expect(result.status).toBe(resource === "locations" ? 404 : 405);
      expect(models[resource].update).not.toHaveBeenCalled();
    },
  );

  test("documents partial updates only for users", () => {
    const operation = swaggerSpec.paths["/api/v1/users/{id}"].patch;
    expect(operation.security).toEqual([{ ApiKey: [] }]);
    expect(operation.requestBody.content["application/json"].schema.$ref).toBe(
      "#/components/schemas/UserPatch",
    );
    expect(swaggerSpec.components.schemas.UserPatch.required).toBeUndefined();
    expect(swaggerSpec.components.schemas.UserPatch.properties).toEqual(
      swaggerSpec.components.schemas.UserUpdate.properties,
    );
    for (const resource of ["blogs", "bookings", "locations", "sessions"]) {
      expect(swaggerSpec.paths[`/api/v1/${resource}/{id}`]).not.toHaveProperty(
        "patch",
      );
    }
  });

  test.each([2, 3])(
    "partially updates user %s without changing omitted fields",
    async (user) => {
      const before = structuredClone(records.users[user - 1]);
      records.users[user - 1].dob = new Date(1990, 4, 12);
      const result = await request(`/users/${user}`, {
        method: "PATCH",
        user,
        body: { first_name: "Patched" },
      });
      expect(result.status).toBe(200);
      expect(result.body.first_name).toBe("Patched");
      expect(result.body.dob).toBe("1990-05-12");
      expect(records.users[user - 1]).toEqual({
        ...before,
        first_name: "Patched",
        dob: "1990-05-12",
      });
      expect(result.body).not.toHaveProperty("password");
      expect(result.body).not.toHaveProperty("authentication_key");
    },
  );

  test.each([
    {},
    { first_name: "" },
    { first_name: null },
    { email: "invalid" },
    { phone: "123" },
    { dob: "1990-02-30" },
    { password: "short" },
    { password: "\u00e9".repeat(20) },
    { role: "admin" },
    { id: 4 },
    { authentication_key: "replacement" },
    { deleted: 1 },
  ])("rejects invalid partial updates without writing: %j", async (body) => {
    const result = await request("/users/3", {
      method: "PATCH",
      user: 3,
      body,
    });
    expect(result.status).toBe(400);
    expect(UsersModel.update).not.toHaveBeenCalled();
    expect(records.users[2].authentication_key).toBe(key(3));
  });

  test.each([
    [undefined, 3, 401],
    [1, 1, 403],
    [2, 3, 403],
    [3, 4, 403],
    [3, 99, 404],
  ])("enforces access for user %s patching %s", async (user, id, status) => {
    expect(
      (
        await request(`/users/${id}`, {
          method: "PATCH",
          user,
          body: { first_name: "Denied" },
        })
      ).status,
    ).toBe(status);
    expect(UsersModel.update).not.toHaveBeenCalled();
  });

  test("preserves empty and unchanged passwords, hashes new passwords and revokes the key", async () => {
    for (const password of ["", "testing123"]) {
      const result = await request("/users/3", {
        method: "PATCH",
        user: 3,
        body: { password },
      });
      expect(result.status).toBe(200);
      expect(records.users[2].password).toBe(passwordHash);
      expect(records.users[2].authentication_key).toBe(key(3));
    }
    const result = await request("/users/3", {
      method: "PATCH",
      user: 3,
      body: { password: "newpassword123", dob: null },
    });
    expect(result.status).toBe(200);
    expect(result.body.dob).toBeNull();
    expect(
      await bcrypt.compare("newpassword123", records.users[2].password),
    ).toBe(true);
    expect(records.users[2].authentication_key).toBeNull();
    expect((await request("/user/self", { user: 3 })).status).toBe(401);
  });
});

describe("OpenAPI contract", () => {
  test("lists trainer summaries publicly while keeping profiles behind /user/self", async () => {
    expect(swaggerSpec.paths["/api/v1/trainers"].get.security).toEqual([]);
    expect(
      swaggerSpec.paths["/api/v1/trainers"].get.responses[200].content[
        "application/json"
      ].schema.items.$ref,
    ).toBe("#/components/schemas/UserSummary");
    expect(swaggerSpec.paths).not.toHaveProperty("/api/v1/users");
    expect(swaggerSpec.paths["/api/v1/users/{id}"]).not.toHaveProperty("get");
    for (const user of [undefined, 2, 3]) {
      const response = await request("/trainers", { user });
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { id: 2, first_name: "New", last_name: "Member", role: "trainer" },
        { id: 5, first_name: "New", last_name: "Member", role: "trainer" },
      ]);
      expect((await request("/users", { user })).status).toBe(404);
    }
    expect((await request("/users/3")).status).toBe(405);
    expect((await request("/trainers", { user: 1 })).status).toBe(403);
    const own = await request("/user/self", { user: 3 });
    expect(own.status).toBe(200);
    expect(own.body.email).toBe("user3@example.com");
    expect((await request("/users/2", { user: 3 })).status).toBe(405);
  });

  test("lets guests, members and trainers list locations but not read by ID", async () => {
    expect(swaggerSpec.paths["/api/v1/locations"].get.security).toEqual([]);
    expect(swaggerSpec.paths["/api/v1/locations/{id}"]).not.toHaveProperty(
      "get",
    );
    for (const user of [undefined, 2, 3]) {
      const list = await request("/locations", { user });
      expect(list.status).toBe(200);
      expect(list.body.map((record) => record.id)).toEqual([1]);
      expect((await request("/locations/1", { user })).status).toBe(404);
    }
    expect((await request("/locations", { user: 1 })).status).toBe(403);
  });

  test.each([undefined, 2, 3])(
    "removes every activities operation (user %s)",
    async (user) => {
      expect(swaggerSpec.paths).not.toHaveProperty("/api/v1/activities");
      expect(swaggerSpec.paths).not.toHaveProperty("/api/v1/activities/{id}");
      for (const [method, path] of [
        ["GET", "/activities"],
        ["GET", "/activities/1"],
        ["POST", "/activities"],
        ["PUT", "/activities/1"],
        ["DELETE", "/activities/1"],
      ]) {
        const result = await request(path, {
          method,
          user,
          ...(["POST", "PUT"].includes(method)
            ? { body: bodies.activities }
            : {}),
        });
        expect(result.status).toBe(404);
      }
      for (const method of [
        "getAll",
        "getById",
        "create",
        "update",
        "delete",
      ]) {
        expect(ActivitiesModel[method]).not.toHaveBeenCalled();
      }
    },
  );

  test.each(Object.entries(removedMethods))(
    "removes unsupported %s operations from the contract and rejects direct requests",
    async (resource, methods) => {
      for (const method of methods) {
        const path = `/${resource}${method === "post" ? "" : "/1"}`;
        for (const user of [2, 3]) {
          const result = await request(path, {
            method: method.toUpperCase(),
            user,
            ...(["post", "put"].includes(method)
              ? { body: bodies[resource] }
              : {}),
          });
          expect(result.status).toBe(
            (resource === "locations" && method !== "post") ||
              (removedBasePaths.includes(resource) && method === "post")
              ? 404
              : 405,
          );
          expect(result.body).toHaveProperty("message");
        }
      }
      expect(models[resource].getById).not.toHaveBeenCalled();
      expect(models[resource].create).not.toHaveBeenCalled();
      expect(models[resource].update).not.toHaveBeenCalled();
      expect(models[resource].delete).not.toHaveBeenCalled();
    },
  );

  test("removes session list and detail reads but keeps the timetable", async () => {
    expect(swaggerSpec.paths).not.toHaveProperty("/api/v1/sessions");
    expect(swaggerSpec.paths["/api/v1/sessions/{id}"]).not.toHaveProperty(
      "get",
    );
    expect(swaggerSpec.paths["/api/v1/sessions/{id}"]).toHaveProperty("delete");
    for (const user of [2, 3]) {
      expect((await request("/sessions", { user })).status).toBe(404);
      expect((await request("/sessions/1", { user })).status).toBe(405);
      expect((await request("/timetable", { user })).status).toBe(200);
    }
    expect(SessionsModel.getById).not.toHaveBeenCalled();
  });

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
    expect(swaggerSpec.tags.map((tag) => tag.name)).toContain("Locations");
    expect(swaggerSpec.tags.map((tag) => tag.name)).not.toContain("Activities");
    expect(
      Object.keys(swaggerSpec.paths).every((path) =>
        path.startsWith("/api/v1/"),
      ),
    ).toBe(true);
    for (const resource of Object.keys(models)) {
      if (resource === "activities") {
        continue;
      }
      if (resource === "sessions") {
        expect(swaggerSpec.paths).not.toHaveProperty("/api/v1/sessions");
        expect(
          Object.keys(swaggerSpec.paths["/api/v1/sessions/{id}"]).sort(),
        ).toEqual(["delete", "parameters"]);
        continue;
      }
      if (resource === "users") {
        expect(swaggerSpec.paths).not.toHaveProperty("/api/v1/users");
        expect(
          Object.keys(swaggerSpec.paths["/api/v1/users/{id}"]).sort(),
        ).toEqual(["parameters", "patch", "put"]);
        expect(swaggerSpec.paths["/api/v1/trainers"]).toHaveProperty("get");
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
      expect(
        (
          await request(`/blogs/${id}`, {
            method: "PUT",
            user: 3,
            body: bodies.blogs,
          })
        ).status,
      ).toBe(400);
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
    "returns a schema-valid own profile by key for user %s",
    async (user) => {
      for (const path of ["/user/self"]) {
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
      expect((await request("/bookings/1", { user })).status).toBe(405);
      expect((await request("/bookings/2", { user })).status).toBe(405);
      expect((await request("/timetable", { user })).status).toBe(200);
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
    for (const id of [1, 2, 3, 4]) {
      expect((await request(`/bookings/${id}`, { user: 2 })).status).toBe(405);
    }
    const otherTrainer = await request("/bookings", { user: 5 });
    expect(otherTrainer.body.map((booking) => booking.id)).toEqual([2]);
    records.sessions[1].trainer_id = 2;
    expect(
      (await request("/bookings", { user: 2 })).body.map(({ id }) => id),
    ).toEqual([1, 2, 3]);
    expect((await request("/bookings", { user: 5 })).body).toEqual([]);
    expect((await request("/bookings/2", { user: 5 })).status).toBe(405);
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
      expect((await request("/user/self", { user })).status).toBe(200);
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
        ).toBe(method === "PUT" ? 403 : 405);
      }
      for (const [method, path] of [
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
        ).toBe(method === "POST" ? 404 : 405);
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
          resource === "activities" ||
            (resource === "locations" && method !== "POST") ||
            (removedBasePaths.includes(resource) && method === "POST")
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

  test("rejects missing/invalid API keys and does not reuse browser sessions", async () => {
    expect((await request("/user/self")).status).toBe(401);
    expect(
      (
        await request("/user/self", {
          headers: { "x-test-cookie-session": "yes" },
        })
      ).status,
    ).toBe(401);
    expect(
      (await request("/user/self", { headers: { "x-auth-key": "invalid" } }))
        .status,
    ).toBe(401);
    expect((await request("/user/self", { user: 99 })).status).toBe(401);
  });

  test("guests can list blogs, locations and trainers but cannot read resource details", async () => {
    for (const path of [
      "/user/self",
      "/users/3",
      "/bookings",
      "/bookings/1",
      "/timetable",
      "/locations/1",
      "/sessions",
      "/sessions/1",
      "/users",
      "/activities",
      "/activities/1",
    ]) {
      expect((await request(path)).status).toBe(
        [
          "/sessions",
          "/users",
          "/activities",
          "/activities/1",
          "/locations/1",
        ].includes(path)
          ? 404
          : ["/users/3", "/bookings/1", "/locations/1", "/sessions/1"].includes(
                path,
              )
            ? 405
            : 401,
      );
    }
    for (const path of ["/blogs", "/locations", "/trainers"]) {
      expect((await request(path)).status).toBe(200);
    }
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

  test("lets guests register as members only", async () => {
    const created = await request("/register", {
      method: "POST",
      body: { ...bodies.users, email: "joiner@example.com", dob: "1990-05-12" },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: 100,
      role: "member",
      email: "joiner@example.com",
      dob: "1990-05-12",
    });
    expect(created.body).not.toHaveProperty("password");
    const stored = records.users.at(-1);
    expect(stored.role).toBe("member");
    expect(await bcrypt.compare("testing123", stored.password)).toBe(true);
    expect(stored.authentication_key).toBeNull();
  });

  test.each([
    [{ email: "user3@example.com" }, 409],
    [{ phone: "12345" }, 400],
    [{ dob: "2001-02-30" }, 400],
    [{ password: "short" }, 400],
    [{ password: "é".repeat(30) }, 400],
    [{ role: "trainer" }, 400],
    [{ first_name: " " }, 400],
  ])("rejects registration with %j", async (change, status) => {
    const result = await request("/register", {
      method: "POST",
      body: { ...bodies.users, ...change },
    });
    expect(result.status).toBe(status);
    expect(UsersModel.create).not.toHaveBeenCalled();
  });

  test.each([1, 2, 3])(
    "rejects registration from authenticated user %s",
    async (user) => {
      const result = await request("/register", {
        method: "POST",
        user,
        body: bodies.users,
      });
      expect(result.status).toBe(403);
      expect(UsersModel.create).not.toHaveBeenCalled();
    },
  );

  test("reports and logs database failures without leaking details", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    UsersModel.getByAuthenticationKey.mockRejectedValue(
      new Error("private database details"),
    );
    const result = await request("/user/self", { user: 1 });
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

  test("blog lists include the author's first name only", async () => {
    records.users[2].first_name = "Jane";
    records.blogs.push({ ...records.blogs[0], id: 2, user_id: 99 });
    for (const user of [undefined, 2, 3]) {
      const result = await request("/blogs", { user });
      expect(result.status).toBe(200);
      expect(result.body.map(({ id, first_name }) => [id, first_name])).toEqual(
        expect.arrayContaining([
          [1, "Jane"],
          [2, null],
        ]),
      );
      expect(result.body[0]).not.toHaveProperty("last_name");
      expect(result.body[0]).not.toHaveProperty("email");
    }
    expect((await request("/blogs/1")).status).toBe(405);
    expect(
      swaggerSpec.paths["/api/v1/blogs"].get.responses[200].content[
        "application/json"
      ].schema.items.$ref,
    ).toBe("#/components/schemas/BlogSummary");
  });

  test("serializes database timestamps as RFC 3339", async () => {
    const result = await request("/bookings", { user: 3 });
    expect(result.status).toBe(200);
    expect(result.body[0].created).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
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
    ).toBe(404);
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
    expect(
      (
        await request("/users/4", {
          method: "PATCH",
          user: 3,
          body: { first_name: "Updated" },
        })
      ).status,
    ).toBe(404);
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

  test("prevents trainers reading, changing or deleting other trainers' sessions", async () => {
    records.sessions.push({ ...records.sessions[0], id: 2, trainer_id: 5 });
    expect((await request("/sessions", { user: 2 })).status).toBe(404);
    expect((await request("/sessions/2", { user: 2 })).status).toBe(405);
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
    ).toBe(404);
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
    ).toBe(404);
    expect(
      (
        await request("/sessions", {
          method: "POST",
          user: 3,
          body: { ...bodies.sessions, trainer_id: 3 },
        })
      ).status,
    ).toBe(404);
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
      ).toBe(method === "GET" ? 405 : 403);
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
      expect((await request("/blogs/1")).status).toBe(405);
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
    expect(
      (
        await request("/blogs/999", {
          method: "PUT",
          user: 3,
          body: bodies.blogs,
        })
      ).status,
    ).toBe(404);
    const result = await request("/missing");
    expect(result.status).toBe(404);
    expect(result.body.message).toBeTruthy();
  });

  test.each([
    {},
    { headers: { "x-auth-key": "invalid" } },
    { user: 99 },
    { headers: { "x-test-cookie-session": "1" } },
  ])("requires a valid API key for timetable reads: %j", async (options) => {
    for (const path of ["/timetable"]) {
      const result = await request(path, options);
      expect(result.status).toBe(401);
      expect(result.body.message).toBeTruthy();
    }
    expect(SessionsModel.getAll).not.toHaveBeenCalled();
    expect(LocationModel.getAll).not.toHaveBeenCalled();
    expect(LocationModel.getById).not.toHaveBeenCalled();
    expect(UsersModel.getAll).not.toHaveBeenCalled();
  });

  test("timetable filters the next seven days for members and trainers", async () => {
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

describe("searching and sorting", () => {
  beforeEach(() => {
    records.blogs.push(
      {
        id: 2,
        title: "Yoga tips",
        content: "Breathe deeply.",
        user_id: 2,
        created: "2026-10-14 09:00:00",
      },
      {
        id: 3,
        title: "Annual meeting",
        content: "Members discuss YOGA classes.",
        user_id: 3,
        created: "2026-10-18 09:00:00",
      },
    );
    records.sessions.push(
      {
        ...bodies.sessions,
        id: 2,
        title: "Boxing",
        date: "2099-11-01",
        time: "07:00:00",
      },
      {
        ...bodies.sessions,
        id: 3,
        title: "Pilates",
        trainer_id: 5,
        date: "2099-10-01",
        time: "08:00:00",
      },
    );
    records.users[3].first_name = "Zara";
    records.users[3].last_name = "Adams";
    records.bookings.push(
      { id: 2, session_id: 2, user_id: 3, created: "2026-10-17 09:00:00" },
      { id: 3, session_id: 1, user_id: 4, created: "2026-10-15 09:00:00" },
      { id: 4, session_id: 3, user_id: 3, created: "2026-10-14 09:00:00" },
    );
  });

  test("documents search and sort parameters for blogs and bookings", () => {
    for (const [resource, sorts] of [
      ["blogs", ["created", "title"]],
      ["bookings", ["session_date", "session", "member", "created"]],
    ]) {
      const parameters =
        swaggerSpec.paths[`/api/v1/${resource}`].get.parameters;
      expect(parameters.map((parameter) => parameter.name)).toEqual([
        "search_term",
        "sort_by",
        "sort_dir",
      ]);
      expect(parameters[1].schema.enum).toEqual(sorts);
    }
  });

  test("lets guests search blog titles and content case-insensitively", async () => {
    const result = await request("/blogs?search_term=yoga");
    expect(result.status).toBe(200);
    expect(result.body.map((blog) => blog.id)).toEqual([3, 2]);
    expect((await request("/blogs?search_term=nothing-matches")).body).toEqual(
      [],
    );
  });

  test("sorts blogs by title or created date", async () => {
    const ids = async (query) =>
      (await request(`/blogs?${query}`, { user: 3 })).body.map(
        (blog) => blog.id,
      );
    expect(await ids("sort_by=title")).toEqual([2, 1, 3]);
    expect(await ids("sort_by=title&sort_dir=asc")).toEqual([3, 1, 2]);
    expect(await ids("sort_by=created")).toEqual([3, 1, 2]);
    expect(await ids("sort_dir=asc")).toEqual([2, 1, 3]);
    expect(await ids("search_term=yoga&sort_by=title&sort_dir=asc")).toEqual([
      3, 2,
    ]);
  });

  test("sorts and searches only a member's own bookings", async () => {
    const ids = async (query) =>
      (await request(`/bookings?${query}`, { user: 3 })).body.map(
        (booking) => booking.id,
      );
    expect(await ids("sort_by=session_date")).toEqual([4, 2, 1]);
    expect(await ids("sort_by=session_date&sort_dir=desc")).toEqual([1, 2, 4]);
    expect(await ids("sort_by=session")).toEqual([2, 1, 4]);
    expect(await ids("sort_by=created&sort_dir=desc")).toEqual([2, 1, 4]);
    expect(await ids("search_term=PILATES")).toEqual([4]);
    expect(await ids("search_term=Morning")).toEqual([1]);
  });

  test("searches trainer bookings by session title only without widening access", async () => {
    const ids = async (query) =>
      (await request(`/bookings?${query}`, { user: 2 })).body.map(
        (booking) => booking.id,
      );
    expect(await ids("sort_by=member")).toEqual([3, 1, 2]);
    expect(await ids("search_term=zara")).toEqual([]);
    expect(await ids("search_term=Morning")).toEqual([1, 3]);
    expect(await ids("search_term=pilates")).toEqual([]);
  });

  test("searches and sorts the timetable for members and trainers", async () => {
    const day = (offset) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return DatabaseModel.toMySqlDate(date);
    };
    records.locations.push({
      ...records.locations[0],
      id: 2,
      name: "Annex",
    });
    records.users[4].first_name = "Alex";
    records.users[4].last_name = "Brown";
    records.users[1].last_name = "Young";
    records.sessions = [
      {
        ...bodies.sessions,
        id: 1,
        title: "Yoga",
        date: day(2),
        time: "09:00:00",
      },
      {
        ...bodies.sessions,
        id: 2,
        title: "Boxing",
        trainer_id: 5,
        location_id: 2,
        date: day(1),
        time: "18:00:00",
      },
      {
        ...bodies.sessions,
        id: 3,
        title: "Cycle",
        date: day(1),
        time: "07:00:00",
      },
      {
        ...bodies.sessions,
        id: 4,
        title: "Later",
        date: day(9),
        time: "07:00:00",
      },
    ];
    const ids = async (query, user = 3) =>
      (await request(`/timetable?${query}`, { user })).body.map(
        (session) => session.id,
      );
    expect(await ids("")).toEqual([3, 2, 1]);
    expect(await ids("sort_dir=desc")).toEqual([1, 2, 3]);
    expect(await ids("sort_by=title")).toEqual([2, 3, 1]);
    expect(await ids("sort_by=trainer", 2)).toEqual([2, 1, 3]);
    expect(await ids("sort_by=location&sort_dir=asc")).toEqual([2, 1, 3]);
    expect(await ids("search_term=YOGA")).toEqual([1]);
    expect(await ids("search_term=alex")).toEqual([]);
    expect(await ids("search_term=annex")).toEqual([]);
    expect(await ids("search_term=ox")).toEqual([2]);
    expect(await ids("search_term=YOGA&location_id=2")).toEqual([]);
    expect(await ids("search_term=YOGA&trainer_id=2")).toEqual([1]);
    expect(await ids("search_term=YOGA", 2)).toEqual([1]);
    expect(await ids("search_term=alex", 2)).toEqual([]);
    expect(await ids("search_term=later")).toEqual([]);
    expect(await ids("trainer_id=2&sort_by=title&sort_dir=desc")).toEqual([
      1, 3,
    ]);
    const parameters = swaggerSpec.paths["/api/v1/timetable"].get.parameters;
    expect(parameters.map((parameter) => parameter.name)).toEqual([
      "location_id",
      "trainer_id",
      "search_term",
      "sort_by",
      "sort_dir",
    ]);
    expect(parameters[3].schema.enum).toEqual([
      "date",
      "title",
      "trainer",
      "location",
    ]);
    expect(parameters[2].description).toBe(
      "Case-insensitive match on session title only.",
    );
    for (const query of [
      "search_term=annex&sort_by=title",
      "search_term=alex",
      "search_term=BOX&sort_by=title",
      "sort_by=location",
      "location_id=1&trainer_id=2",
    ]) {
      expect((await request(`/timetable?${query}`)).status).toBe(401);
    }
    expect(swaggerSpec.paths["/api/v1/timetable"].get.security).toEqual([
      { ApiKey: [] },
    ]);
    expect(
      (await request("/timetable?sort_by=title", { user: 1 })).status,
    ).toBe(403);
    expect(
      (await request("/timetable?sort_by=created", { user: 3 })).status,
    ).toBe(400);
  });

  test("rejects invalid sort fields and directions", async () => {
    for (const query of [
      "sort_by=user_id",
      "sort_dir=up",
      `search_term=${"x".repeat(101)}`,
    ]) {
      expect((await request(`/blogs?${query}`)).status).toBe(400);
      expect((await request(`/bookings?${query}`, { user: 3 })).status).toBe(
        400,
      );
    }
    expect((await request("/bookings?sort_by=title", { user: 3 })).status).toBe(
      400,
    );
    expect((await request("/bookings?search_term=yoga")).status).toBe(401);
  });
});

describe("XML exports", () => {
  const day = (offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return DatabaseModel.toMySqlDate(date);
  };
  const xml = async (path, user) => {
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      headers: user ? { "x-auth-key": key(user) } : {},
    });
    return {
      status: response.status,
      type: response.headers.get("content-type"),
      disposition: response.headers.get("content-disposition"),
      body: await response.text(),
    };
  };
  const ids = (body, element) =>
    [...body.matchAll(new RegExp(`<${element}>\\s*<id>(\\d+)</id>`, "g"))].map(
      (match) => Number(match[1]),
    );

  beforeEach(() => {
    records.users[2].first_name = "Mia";
    records.users[1].first_name = "Tom";
    records.sessions = [
      { ...bodies.sessions, id: 1, date: day(2), time: "09:00:00" },
      { ...bodies.sessions, id: 2, date: day(1), time: "07:00:00" },
      { ...bodies.sessions, id: 3, trainer_id: 5, date: day(1) },
      { ...bodies.sessions, id: 4, date: day(9), time: "07:00:00" },
      { ...bodies.sessions, id: 5, date: day(-1), time: "07:00:00" },
      { ...bodies.sessions, id: 6, trainer_id: 5, date: day(-30) },
      { ...bodies.sessions, id: 7, date: day(-2), time: "09:00:00" },
    ];
    records.bookings = [1, 2, 3, 4, 5, 6].map((sessionId) => ({
      id: sessionId,
      session_id: sessionId,
      user_id: 3,
      created: "2026-10-16 09:00:00",
    }));
    records.bookings.push({
      ...records.bookings[0],
      id: 7,
      session_id: 7,
      user_id: 4,
    });
  });

  test("members download all their past bookings as XML", async () => {
    const result = await xml("/bookings/export.xml", 3);
    expect(result.status).toBe(200);
    expect(result.type).toMatch(/^application\/xml/);
    expect(result.disposition).toBe('attachment; filename="gym-bookings.xml"');
    expect(result.body).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(result.body).toContain("<!DOCTYPE gymBookings [");
    expect(ids(result.body, "booking")).toEqual([6, 5]);
    expect(result.body).toContain("<firstName>Mia</firstName>");
    expect(result.body).toContain("<firstName>Tom</firstName>");
    expect(result.body).toContain("<name>City</name>");
    expect(result.body).toContain("<created>16/10/2026, 9:00am</created>");
    expect(result.body).toContain(
      `<date>${day(-1).split("-").reverse().join("/")}</date>`,
    );
    expect(result.body).toContain("<time>7:00am</time>");
    expect(ids((await xml("/bookings/export.xml", 4)).body, "booking")).toEqual(
      [7],
    );
  });

  test("trainers download their own upcoming sessions as XML", async () => {
    const result = await xml("/sessions/export.xml", 2);
    expect(result.status).toBe(200);
    expect(result.type).toMatch(/^application\/xml/);
    expect(result.disposition).toBe('attachment; filename="gym-sessions.xml"');
    expect(result.body).toContain("<!DOCTYPE gymSessions [");
    expect(ids(result.body, "session")).toEqual([2, 1]);
    expect(result.body).toContain("<firstName>Tom</firstName>");
    expect(result.body).toContain(
      `<date>${day(2).split("-").reverse().join("/")}</date>`,
    );
    expect(result.body).toContain("<time>9:00am</time>");
    expect(result.body).not.toContain("<booking>");
    expect(ids((await xml("/sessions/export.xml", 5)).body, "session")).toEqual(
      [3],
    );
  });

  test("restricts XML exports by role and documents them", async () => {
    expect((await xml("/bookings/export.xml")).status).toBe(401);
    expect((await xml("/bookings/export.xml", 2)).status).toBe(403);
    expect((await xml("/bookings/export.xml", 1)).status).toBe(403);
    expect((await xml("/sessions/export.xml")).status).toBe(401);
    expect((await xml("/sessions/export.xml", 3)).status).toBe(403);
    expect((await xml("/sessions/export.xml", 1)).status).toBe(403);
    expect((await request("/bookings", { user: 3 })).status).toBe(200);
    expect((await request("/sessions/1", { user: 2 })).status).toBe(405);
    for (const path of ["bookings", "sessions"]) {
      const operation = swaggerSpec.paths[`/api/v1/${path}/export.xml`].get;
      expect(operation.security).toEqual([{ ApiKey: [] }]);
      expect(operation.responses[200].content).toHaveProperty(
        "application/xml",
      );
    }
  });
});
