import { expect, test } from "@jest/globals";
import ejs from "ejs";
import { fileURLToPath } from "node:url";

const template = fileURLToPath(
  new URL("../views/partials/nav-links.ejs", import.meta.url),
);

test.each([
  ["/", undefined, "/"],
  ["/timetable", undefined, "/timetable"],
  ["/authenticate", undefined, "/authenticate"],
  ["/authenticate/register", undefined, "/authenticate/register"],
  ["/bookings/12", "member", "/bookings"],
  ["/sessions/12", "trainer", "/sessions"],
  ["/manage/bookings/12", "admin", "/manage/bookings"],
  ["/manage/blogs/12", "admin", "/manage/blogs"],
  ["/users/12", "admin", "/users"],
  ["/activities", "admin", "/activities"],
  ["/locations", "admin", "/locations"],
  ["/blogs/12", "member", "/blogs"],
])("highlights %s for %s", async (currentPath, role, link) => {
  const html = await ejs.renderFile(template, {
    currentPath,
    authenticatedUser: role ? { role } : undefined,
  });
  expect(html).toContain(`href="${link}" aria-current="page"`);
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
});

test.each(["/users-extra", "/unknown", "/privacy-policy.html"])(
  "does not highlight an unrelated page: %s",
  async (currentPath) => {
    const html = await ejs.renderFile(template, {
      currentPath,
      authenticatedUser: { role: "admin" },
    });
    expect(html).not.toContain('aria-current="page"');
  },
);
