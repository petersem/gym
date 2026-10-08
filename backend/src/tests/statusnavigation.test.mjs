import { afterAll, beforeAll, expect, test } from "@jest/globals";
import express from "express";
import { fileURLToPath } from "node:url";
import { AuthenticationController } from "../controllers/AuthenticationController.mjs";

let server;
let baseUrl;

beforeAll(async () => {
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", fileURLToPath(new URL("../views", import.meta.url)));
  app.use((req, _res, next) => {
    const role = req.headers["x-test-role"];
    req.authenticatedUser = role
      ? {
          id: 1,
          role,
          first_name: "Test",
          last_name: "User",
        }
      : undefined;
    next();
  });
  app.use(AuthenticationController.middleware);
  app.get("/status", (_req, res) =>
    res.status(409).render("status.ejs", {
      status: "Booking Conflict",
      message: "A booking conflict occurred.",
    }),
  );
  app.get("/restricted", AuthenticationController.restrict(["admin"]));
  app.get("/logout", (req, res) => {
    req.session.userId = 1;
    AuthenticationController.handleLogout(req, res);
  });
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test.each(["admin", "trainer", "member", undefined])(
  "status pages retain the authenticated menu for %s",
  async (role) => {
    const response = await fetch(`${baseUrl}/status`, {
      headers: role ? { "x-test-role": role } : {},
    });
    expect(response.status).toBe(409);
    const html = await response.text();
    expect(html.includes('href="/manage/bookings"')).toBe(role === "admin");
    expect(html.includes('href="/users"')).toBe(role === "admin");
    expect(html.includes('href="/bookings"')).toBe(role === "member");
    expect(html.includes('href="/authenticate/logout"')).toBe(Boolean(role));
    expect(html.includes('href="/authenticate/register"')).toBe(!role);
    expect(html.includes("Test User,")).toBe(Boolean(role));
  },
);

test("access-denied status pages retain member navigation", async () => {
  const response = await fetch(`${baseUrl}/restricted`, {
    headers: { "x-test-role": "member" },
  });
  expect(response.status).toBe(403);
  const html = await response.text();
  expect(html).toContain('href="/bookings"');
  expect(html).not.toContain('href="/authenticate/register"');
});

test("logout status pages show guest navigation rather than stale staff links", async () => {
  const response = await fetch(`${baseUrl}/logout`, {
    headers: { "x-test-role": "admin" },
  });
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain('href="/authenticate/register"');
  expect(html).not.toContain('href="/manage/bookings"');
  expect(html).not.toContain('href="/authenticate/logout"');
});
