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

const routes = [
  ["/activities", ActivitiesController.routes, ["admin"]],
  ["/locations", LocationController.routes, ["admin"]],
  ["/users", UsersController.routes, ["admin"]],
  ["/sessions", SessionsController.routes, ["admin", "trainer"]],
  [
    "/manage/bookings",
    BookingManagementController.routes,
    ["admin"],
  ],
  ["/manage/blogs", BlogController.managementRoutes, ["admin"]],
  ["/bookings", BookingsController.routes, ["member"]],
  [
    "/timetable",
    BookingsController.timetableRoutes,
    ["member", "guest"],
    ["member"],
  ],
  ["/blogs", BlogController.routes, ["trainer", "member", "guest"]],
];
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
  for (const [path, router] of routes) app.use(path, router);
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
    for (const [path, , readers, writers = readers] of routes) {
      for (const method of ["GET", "POST"]) {
        modelSpies.forEach((spy) => spy.mockClear());
        const allowed = (method === "GET" ? readers : writers).includes(role);
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: { "x-test-role": role },
          ...(method === "POST"
            ? { body: new URLSearchParams({ action: "create" }) }
            : {}),
          redirect: "manual",
        });
        const deniedStatus = role === "guest" ? 401 : 403;
        expect({ path, method, status: response.status }).toEqual({
          path,
          method,
          status: allowed ? (method === "GET" ? 200 : 303) : deniedStatus,
        });
        if (!allowed) {
          for (const spy of modelSpies) expect(spy).not.toHaveBeenCalled();
        }
      }
    }
  },
);
