import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  jest,
  test,
} from "@jest/globals";
import express from "express";
import { fileURLToPath } from "node:url";
import { ActivitiesController } from "../../controllers/ActivitiesController.mjs";
import { AuthenticationController } from "../../controllers/AuthenticationController.mjs";
import { LocationController } from "../../controllers/LocationController.mjs";
import { UsersController } from "../../controllers/UsersController.mjs";
import { SessionsController } from "../../controllers/SessionsController.mjs";
import { BookingManagementController } from "../../controllers/BookingManagementController.mjs";
import { BlogController } from "../../controllers/BlogController.mjs";
import { BookingsController } from "../../controllers/BookingsController.mjs";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import { LocationModel } from "../../models/LocationModel.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";
import { SessionsModel } from "../../models/SessionsModel.mjs";
import { BookingsModel } from "../../models/BookingsModel.mjs";
import { BlogModel } from "../../models/BlogModel.mjs";

/**
 * Routers under test with the roles allowed to read and submit.
 * `paths` are exercised with GET and POST, `readOnlyPaths` with GET only.
 * `writers` defaults to `readers` when submission matches read access.
 * A path may be `{ path, allowed }` to override the status an authorised role
 * receives, such as a 404 for a record ID that does not exist.
 */
const routes = [
  {
    mount: "/activities",
    router: ActivitiesController.routes,
    paths: ["/", "/7"],
    readers: ["admin"],
  },
  {
    mount: "/locations",
    router: LocationController.routes,
    paths: ["/", "/7"],
    readers: ["admin"],
  },
  {
    mount: "/users",
    router: UsersController.routes,
    paths: ["/", "/7"],
    readers: ["admin"],
  },
  {
    mount: "/sessions",
    router: SessionsController.routes,
    paths: ["/", "/7"],
    readers: ["admin", "trainer"],
  },
  {
    mount: "/manage/bookings",
    router: BookingManagementController.routes,
    paths: ["/", { path: "/7", allowed: { GET: 404 } }],
    readers: ["admin"],
  },
  {
    mount: "/manage/blogs",
    router: BlogController.managementRoutes,
    paths: ["/", "/7"],
    readers: ["admin"],
  },
  {
    mount: "/bookings",
    router: BookingsController.routes,
    paths: ["/", "/7"],
    readOnlyPaths: ["/export.xml"],
    readers: ["member"],
  },
  {
    mount: "/timetable",
    router: BookingsController.timetableRoutes,
    paths: ["/"],
    readers: ["member", "guest"],
    writers: ["member"],
  },
  {
    mount: "/blogs",
    router: BlogController.routes,
    paths: ["/", "/7"],
    readers: ["trainer", "member", "guest"],
  },
  {
    mount: "/authenticate",
    router: AuthenticationController.routes,
    readOnlyPaths: ["/", "/register"],
    readers: ["admin", "trainer", "member", "guest"],
  },
];

/** Status an authorised role receives when no override is given. */
const defaultAllowed = { GET: 200, POST: 303 };

/**
 * Expands a router entry into the individual requests to check.
 * @param {(typeof routes)[number]} entry Router entry.
 * @returns {{url: string, method: "GET"|"POST", allowedStatus: number}[]} Requests to send.
 */
const requestsFor = ({ mount, paths = [], readOnlyPaths = [] }) => {
  const expand = (entry, methods) => {
    const { path, allowed = {} } =
      typeof entry === "string" ? { path: entry } : entry;
    const url = path === "/" ? mount : `${mount}${path}`;
    return methods.map((method) => ({
      url,
      method,
      allowedStatus: allowed[method] ?? defaultAllowed[method],
    }));
  };
  return [
    ...paths.flatMap((entry) => expand(entry, ["GET", "POST"])),
    ...readOnlyPaths.flatMap((entry) => expand(entry, ["GET"])),
  ];
};
let server;
let baseUrl;
let modelSpies;

beforeAll(async () => {
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", fileURLToPath(new URL("../../views", import.meta.url)));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    const role = req.headers["x-test-role"];
    req.authenticatedUser =
      role === "guest"
        ? undefined
        : {
            id: 1,
            role,
            first_name: "Test",
            last_name: "User",
          };
    res.locals.authenticatedUser = req.authenticatedUser;
    req.session = { save: (callback) => callback() };
    next();
  });
  for (const { mount, router } of routes) app.use(mount, router);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => {
  modelSpies = [];
  for (const model of [
    ActivitiesModel,
    LocationModel,
    UsersModel,
    SessionsModel,
    BookingsModel,
    BlogModel,
  ]) {
    for (const method of ["getAll", "getById", "create", "update", "delete"]) {
      modelSpies.push(
        jest
          .spyOn(model, method)
          .mockResolvedValue(method === "getAll" ? [] : {}),
      );
    }
  }
  for (const [model, key] of [
    [ActivitiesModel, "activities"],
    [LocationModel, "locations"],
    [UsersModel, "users"],
    [BlogModel, "blogs"],
  ]) {
    modelSpies.push(
      jest.spyOn(model, "list").mockResolvedValue({ [key]: [], total: 0 }),
    );
  }
  modelSpies.push(
    jest.spyOn(BookingsModel, "getByUserId").mockResolvedValue([]),
  );
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test.each(["admin", "trainer", "member", "guest"])(
  "enforces read and submission access across routes for %s",
  async (role) => {
    for (const entry of routes) {
      const { readers, writers = readers } = entry;
      for (const { url, method, allowedStatus } of requestsFor(entry)) {
        modelSpies.forEach((spy) => spy.mockClear());
        const allowed = (method === "GET" ? readers : writers).includes(role);
        const response = await fetch(`${baseUrl}${url}`, {
          method,
          headers: { "x-test-role": role },
          ...(method === "POST"
            ? { body: new URLSearchParams({ action: "create" }) }
            : {}),
          redirect: "manual",
        });
        const deniedStatus = role === "guest" ? 401 : 403;
        expect({ url, method, status: response.status }).toEqual({
          url,
          method,
          status: allowed ? allowedStatus : deniedStatus,
        });
        if (!allowed) {
          for (const spy of modelSpies) expect(spy).not.toHaveBeenCalled();
        }
      }
    }
  },
);
