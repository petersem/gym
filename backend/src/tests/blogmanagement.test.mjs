import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import express from "express";
import { fileURLToPath } from "node:url";
import { BlogController } from "../controllers/BlogController.mjs";
import { BlogModel } from "../models/BlogModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";

let server;
let baseUrl;
beforeAll(async () => {
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", fileURLToPath(new URL("../views", import.meta.url)));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    const role = req.headers["x-test-role"];
    req.authenticatedUser = role ? { id: 7, role } : undefined;
    res.locals.authenticatedUser = req.authenticatedUser;
    req.session = { save: (callback) => callback() };
    next();
  });
  app.use("/manage/blogs", BlogController.managementRoutes);
  app.use("/blogs", BlogController.routes);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("admin blog management", () => {
  test("blocks admin public blog reads and all write actions before model access", async () => {
    const spies = [
      jest.spyOn(BlogModel, "list"),
      jest.spyOn(BlogModel, "getById"),
      jest.spyOn(UsersModel, "getAll"),
      ...["create", "update", "delete"].map((method) =>
        jest.spyOn(BlogModel, method),
      ),
    ];
    for (const path of ["/blogs", "/blogs/1"]) {
      const read = await fetch(`${baseUrl}${path}`, {
        headers: { "x-test-role": "admin" },
      });
      expect(read.status).toBe(403);
      expect(await read.text()).toContain("Admins must use Manage Blogs");
      for (const action of ["create", "update", "delete"]) {
        const write = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers: { "x-test-role": "admin" },
          body: new URLSearchParams({ action, title: "Post", content: "Body" }),
          redirect: "manual",
        });
        expect(write.status).toBe(403);
      }
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  test.each(["member", "trainer", undefined])(
    "preserves public blog viewing for %s",
    async (role) => {
      jest.spyOn(BlogModel, "list").mockResolvedValue({ blogs: [], total: 0 });
      jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
      const response = await fetch(`${baseUrl}/blogs`, {
        headers: role ? { "x-test-role": role } : {},
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('id="posts"');
    },
  );

  test.each(["trainer", "member", undefined])(
    "rejects reads and writes for %s before accessing models",
    async (role) => {
      const list = jest.spyOn(BlogModel, "list");
      const create = jest.spyOn(BlogModel, "create");
      for (const method of ["GET", "POST"]) {
        for (const path of ["", "/1"]) {
          const response = await fetch(`${baseUrl}/manage/blogs${path}`, {
            method,
            headers: role ? { "x-test-role": role } : {},
          });
          expect(response.status).toBe(role ? 403 : 401);
        }
      }
      expect(list).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    },
  );

  test("keeps admin links, forms and pagination on the management page", async () => {
    const blogs = [
      {
        id: 1,
        user_id: 7,
        title: "Test post",
        content: "Body",
        created: new Date(),
      },
    ];
    jest.spyOn(BlogModel, "list").mockResolvedValue({ blogs, total: 21 });
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    const response = await fetch(`${baseUrl}/manage/blogs/1`, {
      headers: { "x-test-role": "admin" },
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('action="/manage/blogs/1"');
    expect(html).toContain('href="/manage/blogs/1?');
    expect(html).toContain('href="/manage/blogs?');
    expect(html).toContain('action="/manage/blogs#posts"');
    expect(html).toContain('class="session-results-table"');
    expect(html.indexOf('id="sort-by"')).toBeLessThan(html.indexOf("<table"));
    expect(html.indexOf("<table")).toBeLessThan(
      html.indexOf('aria-label="Posts pagination"'),
    );
    expect(html.indexOf('aria-label="Posts pagination"')).toBeLessThan(
      html.indexOf('id="blog-management"'),
    );
  });

  test.each(["create", "update", "delete"])(
    "redirects successful %s actions to admin management",
    async (action) => {
      jest.spyOn(BlogModel, "create").mockResolvedValue({ insertId: 1 });
      jest.spyOn(BlogModel, "update").mockResolvedValue({ affectedRows: 1 });
      jest.spyOn(BlogModel, "delete").mockResolvedValue({ affectedRows: 1 });
      jest.spyOn(BlogModel, "getById").mockResolvedValue({ id: 1, user_id: 7 });
      const response = await fetch(
        `${baseUrl}/manage/blogs${action === "create" ? "" : "/1"}`,
        {
          method: "POST",
          headers: { "x-test-role": "admin" },
          body: new URLSearchParams({ action, title: "Test", content: "Body" }),
          redirect: "manual",
        },
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/manage/blogs");
    },
  );

  test("redirects validation feedback within admin management", async () => {
    const response = await fetch(`${baseUrl}/manage/blogs`, {
      method: "POST",
      headers: { "x-test-role": "admin" },
      body: new URLSearchParams({ action: "create", title: "", content: "" }),
      redirect: "manual",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/manage/blogs#form-validation",
    );
  });
});
