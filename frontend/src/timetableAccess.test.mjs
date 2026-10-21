import { expect, jest, test } from "@jest/globals";
import { can, PERMISSIONS } from "./common/permissions.mjs";

jest.unstable_mockModule("@tailwindcss/vite", () => ({
  default: () => [],
}));
const configurePWA = jest.fn(() => []);
jest.unstable_mockModule("vite-plugin-pwa", () => ({
  VitePWA: configurePWA,
}));
const { default: viteConfig } = await import("../vite.config.js");

test("only members and trainers can view the timetable and lookup lists", () => {
  for (const permission of ["viewTimetable", "readLocations", "listTrainers"]) {
    expect(PERMISSIONS[permission]).toEqual(["member", "trainer"]);
    for (const user of [null, { role: "guest" }, { role: "admin" }]) {
      expect(can(user, permission)).toBe(false);
    }
    for (const role of ["member", "trainer"]) {
      expect(can({ role }, permission)).toBe(true);
    }
  }
  expect(can(null, "readBlogs")).toBe(true);
});

test("the public API cache excludes protected lists, including old cached URLs", () => {
  viteConfig({ mode: "test" });
  const rules = configurePWA.mock.calls[0][0].workbox.runtimeCaching;
  const cached = (path, authenticated = false) =>
    rules.some((rule) =>
      rule.urlPattern({
        url: new URL(`https://gym.example${path}`),
        request: new Request(`https://gym.example${path}`, {
          headers: authenticated ? { "x-auth-key": "test-key" } : {},
        }),
      }),
    );

  for (const path of [
    "/api/v1/timetable",
    "/api/v1/timetable/",
    "/api/v1/timetable?search_term=yoga&location_id=1",
    "/api/v1/bookings",
    "/api/v1/user/self",
    "/api/v1/locations",
    "/api/v1/locations/1",
    "/api/v1/trainers",
    "/api/v1/activities",
  ]) {
    expect(cached(path)).toBe(false);
    expect(cached(path, true)).toBe(false);
  }
  for (const path of ["/api/v1/blogs", "/api/v1/blogs/1"]) {
    expect(cached(path)).toBe(true);
    expect(cached(path, true)).toBe(false);
  }
});
