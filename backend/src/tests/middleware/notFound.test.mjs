import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import express from "express";
import { fileURLToPath } from "node:url";
import { notFound } from "../../middleware/notFound.mjs";
import { LocationController } from "../../controllers/LocationController.mjs";

let server;
let baseUrl;

beforeAll(async () => {
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", fileURLToPath(new URL("../../views", import.meta.url)));
  app.locals.version = "test";
  app.use((req, _res, next) => {
    if (req.headers["x-test-user"]) {
      req.authenticatedUser = { id: 1, role: "admin" };
    }
    next();
  });
  app.get("/existing", (_req, res) => res.send("Existing page"));
  app.use("/locations", LocationController.routes);
  app.use(
    express.static(fileURLToPath(new URL("../../public", import.meta.url))),
  );
  app.use(notFound);
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

describe("notFound middleware", () => {
  test.each([
    ["GET", "/unknown", {}],
    ["GET", "/locations/1/unknown", { "x-test-user": "admin" }],
    ["POST", "/unknown", {}],
    ["GET", "/missing.css", {}],
  ])("renders the status page for %s %s", async (method, path, headers) => {
    const response = await fetch(`${baseUrl}${path}`, { method, headers });
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("404 - Page not found");
    expect(html).toContain(
      "The page you requested does not exist. Please check the URL.",
    );
    expect(html).toContain("Back to dashboard");
  });

  test("preserves existing routes and static files", async () => {
    const page = await fetch(`${baseUrl}/existing`);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("Existing page");
    const asset = await fetch(`${baseUrl}/css/style.css`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("text/css");
  });

  test("reports invalid IDs that match the location router", async () => {
    const response = await fetch(`${baseUrl}/locations/sales`, {
      headers: { "x-test-user": "admin" },
    });
    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("Location not found");
    expect(html).toContain("The requested location does not exist.");
  });
});
