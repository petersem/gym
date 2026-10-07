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
import session from "express-session";
import { formFeedback } from "../../middleware/formFeedback.mjs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { AuthenticationController } from "../../controllers/AuthenticationController.mjs";
import { UsersController } from "../../controllers/UsersController.mjs";
import { LocationController } from "../../controllers/LocationController.mjs";
import { ActivitiesController } from "../../controllers/ActivitiesController.mjs";
import { BlogController } from "../../controllers/BlogController.mjs";
import { SessionsController } from "../../controllers/SessionsController.mjs";
import { BookingsController } from "../../controllers/BookingsController.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";
import { LocationModel } from "../../models/LocationModel.mjs";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import { BlogModel } from "../../models/BlogModel.mjs";
import { SessionsModel } from "../../models/SessionsModel.mjs";
import { BookingsModel } from "../../models/BookingsModel.mjs";

const managementRoutes = [
  ["/users", UsersController.routes, UsersModel, true],
  ["/locations", LocationController.routes, LocationModel, true],
  ["/activities", ActivitiesController.routes, ActivitiesModel, true],
  ["/blogs", BlogController.routes, BlogModel, true],
  ["/sessions", SessionsController.routes, SessionsModel, true],
  ["/timetable", BookingsController.timetableRoutes, BookingsModel, false],
  ["/bookings", BookingsController.routes, BookingsModel, true],
];
let server;
let baseUrl;
const store = new session.MemoryStore();

beforeAll(async () => {
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", fileURLToPath(new URL("../../views", import.meta.url)));
  app.locals.version = "test";
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      secret: "form-validation-tests",
      resave: false,
      saveUninitialized: false,
      store,
    }),
  );
  app.use((req, _res, next) => {
    req.authenticatedUser = { id: 1, role: "admin" };
    next();
  });
  app.use(formFeedback);
  app.use("/authenticate", AuthenticationController.routes);
  for (const [path, controller] of managementRoutes) {
    app.use(path, controller);
  }
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => jest.restoreAllMocks());
beforeEach(async () => {
  await new Promise((resolve, reject) =>
    store.clear((error) => (error ? reject(error) : resolve())),
  );
});
afterAll(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

const post = (path, body = {}) =>
  fetch(`${baseUrl}${path}`, {
    method: "POST",
    body: new URLSearchParams(body),
    redirect: "manual",
  });

const mockPages = () => {
  jest.spyOn(UsersModel, "list").mockResolvedValue({ users: [], total: 0 });
  jest
    .spyOn(LocationModel, "list")
    .mockResolvedValue({ locations: [], total: 0 });
  jest
    .spyOn(ActivitiesModel, "list")
    .mockResolvedValue({ activities: [], total: 0 });
  jest.spyOn(BlogModel, "list").mockResolvedValue({ blogs: [], total: 0 });
  for (const [, , model] of managementRoutes) {
    jest.spyOn(model, "getAll").mockResolvedValue([]);
  }
  jest.spyOn(BookingsModel, "getBySessionId").mockResolvedValue([]);
};

describe("mounted form validation", () => {
  test.each([
    ["/timetable", "Available sessions next 7 days", "Bookings next 7 days"],
    ["/bookings", "Bookings next 7 days", "Available sessions next 7 days"],
  ])(
    "serves the separate page at %s",
    async (path, visibleSection, hiddenSection) => {
      mockPages();
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(visibleSection);
      expect(html).not.toContain(hiddenSection);
    },
  );

  test.each([
    "/authenticate",
    "/authenticate/register",
    ...managementRoutes.flatMap(([path, , , hasIdRoute]) =>
      hasIdRoute ? [path, `${path}/1`] : [path],
    ),
  ])("rejects invalid %s submissions before side effects", async (path) => {
    const writes = managementRoutes.flatMap(([, , model]) =>
      ["create", "update", "delete"].map((method) => jest.spyOn(model, method)),
    );
    const lookup = jest.spyOn(UsersModel, "getByUsername");
    const hash = jest.spyOn(bcrypt, "hash");
    const hashSync = jest.spyOn(bcrypt, "hashSync");
    const response = await post(path, { action: "create", password: "short" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${path}#form-validation`);
    const sessions = await new Promise((resolve, reject) =>
      store.all((error, data) => (error ? reject(error) : resolve(data))),
    );
    const feedback = Object.values(sessions).find(
      (entry) => entry.formFeedback?.[path],
    )?.formFeedback[path];
    expect(feedback).toBeDefined();
    expect(feedback.values).not.toHaveProperty("password");
    for (const spy of [...writes, lookup, hash, hashSync]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  test.each(managementRoutes.filter(([, , , hasIdRoute]) => hasIdRoute))(
    "supports ID-only deletion through %s",
    async (path, _controller, model) => {
      const deletion = jest
        .spyOn(model, "delete")
        .mockResolvedValue({ affectedRows: 1 });
      jest.spyOn(BlogModel, "getById").mockResolvedValue({ user_id: 1 });
      jest.spyOn(BookingsModel, "deleteBySessionId").mockResolvedValue({});
      const hash = jest.spyOn(bcrypt, "hashSync");
      const response = await post(`${path}/1`, { action: "delete" });
      expect([302, 303]).toContain(response.status);
      expect(deletion).toHaveBeenCalledWith(path === "/users" ? "1" : 1);
      expect(hash).not.toHaveBeenCalled();
    },
  );

  test("valid registration reaches hashing and model creation with trimmed data", async () => {
    const hash = jest
      .spyOn(bcrypt, "hash")
      .mockResolvedValue("hashed-password");
    const create = jest
      .spyOn(UsersModel, "create")
      .mockResolvedValue({ insertId: 1 });
    const response = await post("/authenticate/register", {
      firstName: " Fred ",
      lastName: "Nerk",
      email: "fn@gym.com",
      password: " password123 ",
      phone: "555-0100",
      dob: "",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/authenticate");
    expect(hash).toHaveBeenCalledWith(" password123 ", 10);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Fred",
        role: "member",
        dob: null,
        password: "hashed-password",
      }),
    );
  });

  test("valid login still supports an existing short password", async () => {
    jest
      .spyOn(UsersModel, "getByUsername")
      .mockResolvedValue({ id: 1, password: "hash" });
    jest.spyOn(bcrypt, "compare").mockResolvedValue(true);
    const response = await post("/authenticate", {
      username: "ada@example.com",
      password: "short",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
  });

  test.each([
    [
      "/authenticate",
      "username",
      "username",
      { username: "bad", password: "secret" },
    ],
    [
      "/authenticate/register",
      "email",
      "email",
      { firstName: "Fred", email: "bad", password: "secret" },
    ],
    [
      "/users",
      "email",
      "email",
      { action: "create", firstName: "Fred", email: "bad", password: "secret" },
    ],
    ["/locations", "name", "name", { action: "create", name: "" }],
    ["/activities", "name", "name", { action: "create", name: "" }],
    ["/blogs", "title", "title", { action: "create", title: "" }],
    [
      "/sessions",
      "time",
      "time",
      { action: "create", title: "Yoga", time: "24:00" },
    ],
    [
      "/timetable",
      "sessionId",
      "booking-session-id",
      { action: "create", sessionId: "bad", userId: "1" },
    ],
  ])(
    "renders %s errors beneath fields after redirect",
    async (path, field, id, body) => {
      mockPages();
      const response = await post(path, body);
      expect(response.status).toBe(303);
      const cookie = response.headers.get("set-cookie").split(";")[0];
      const page = await fetch(
        `${baseUrl}${response.headers.get("location")}`,
        { headers: { cookie } },
      );
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain(`id="${id}-error"`);
      expect(html).toMatch(
        new RegExp(`name="${field}"[\\s\\S]*?id="${id}-error"`),
      );
      expect(html).toContain("Please correct the highlighted fields.");
      expect(response.headers.get("location")).toBe(`${path}#form-validation`);
      expect(html).toContain('id="form-validation"');
      expect(html).toContain(
        '<script src="/js/formFeedback.js" defer></script>',
      );
      expect(html).toContain('role="alert" tabindex="-1"');
      expect(html).toContain("novalidate");
      expect(html).not.toMatch(/\s(?:required|minlength|maxlength|pattern)=?/);
      expect(html).not.toContain('value="secret"');
      if (body.firstName) {
        expect(html).toContain('value="Fred"');
      }
      if (field === "time") {
        expect(html).toContain('value="24:00"');
        expect(html).toMatch(/id="time" name="time" type="hidden"/);
        expect(html).toContain('id="time-hour"');
        expect(html).toContain('id="time-minute"');
        expect(html).toContain('id="time-meridiem"');
        expect(html).toContain(
          '.form.addEventListener("submit", updateSessionTime)',
        );
      }
      const refreshed = await fetch(`${baseUrl}${path}`, {
        headers: { cookie },
      });
      expect(await refreshed.text()).not.toContain(`id="${id}-error"`);
    },
  );

  test("keeps feedback isolated by page, query, and browser session", async () => {
    mockPages();
    const response = await post("/activities?search_term=Yoga&page=2", {
      action: "create",
      name: "",
      description: "My description",
    });
    const cookie = response.headers.get("set-cookie").split(";")[0];
    expect(response.headers.get("location")).toBe(
      "/activities?search_term=Yoga&page=2#form-validation",
    );
    for (const [path, headers] of [
      ["/activities", { cookie }],
      ["/authenticate", { cookie }],
      ["/activities?search_term=Yoga&page=2", {}],
    ]) {
      const page = await fetch(`${baseUrl}${path}`, { headers });
      expect(await page.text()).not.toContain('id="name-error"');
    }
    const page = await fetch(`${baseUrl}/activities?search_term=Yoga&page=2`, {
      headers: { cookie },
    });
    const html = await page.text();
    expect(html).toContain('id="name-error"');
    expect(html).toContain("My description</textarea>");
  });

  test("keeps the edit action when the record is outside the filtered list", async () => {
    mockPages();
    jest.spyOn(ActivitiesModel, "getById").mockResolvedValue({
      id: 7,
      name: "Old",
      description: "Old description",
    });
    const response = await post("/activities/7?search_term=Other", {
      action: "update",
      name: "",
      description: "Changed",
    });
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}${response.headers.get("location")}`, {
      headers: { cookie },
    });
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('action="/activities/7?search_term=Other"');
    expect(html).toContain('value="update"');
    expect(html).toContain("Changed</textarea>");
    expect(html).toContain('value="" aria-invalid="true"');
  });

  test("escapes retained HTML and preserves valid select choices on user edits", async () => {
    mockPages();
    jest.spyOn(UsersModel, "getById").mockResolvedValue({
      id: 7,
      first_name: "Original",
      last_name: "Name",
      role: "admin",
      email: "original@example.com",
      password: "stored-password-hash",
      phone: "555-0100",
      deleted: 0,
      authentication_key: "",
      dob: null,
    });
    const response = await post("/users/7", {
      action: "update",
      firstName: "<script>alert(1)</script>",
      lastName: "Changed",
      role: "trainer",
      email: "bad",
      password: "private-password",
      phone: "555-0100",
    });
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const page = await fetch(`${baseUrl}/users/7`, { headers: { cookie } });
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('value="trainer" selected');
    expect(html).not.toContain("private-password");
    expect(html).not.toContain("stored-password-hash");
  });
});
