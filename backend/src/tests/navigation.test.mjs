import { describe, expect, test } from "@jest/globals";
import ejs from "ejs";
import { fileURLToPath } from "node:url";

const navigation = fileURLToPath(
  new URL("../views/partials/nav-links.ejs", import.meta.url),
);
const manageLinks = [
  ["/sessions", "Sessions"],
  ["/activities", "Activities"],
  ["/locations", "Locations"],
  ["/users", "Users"],
  ["/manage/blogs", "Blogs"],
];

describe("navigation menu", () => {
  test.each(["member", "admin", "trainer", undefined])(
    "shows Bookings only to members when role is %s",
    async (role) => {
      const html = await ejs.renderFile(navigation, {
        authenticatedUser: role ? { role } : undefined,
      });
      expect(html.includes('href="/bookings"')).toBe(role === "member");
      expect(html).toContain('href="/timetable"');
    },
  );

  test("shows all management links to admins", async () => {
    const html = await ejs.renderFile(navigation, {
      authenticatedUser: { role: "admin" },
    });

    expect(html).toMatch(/<summary>Manage<\/summary>/);
    for (const [href, label] of manageLinks) {
      expect(html).toContain(`<a href="${href}">${label}</a>`);
    }
  });

  test("shows trainers only the sessions link under Manage", async () => {
    const html = await ejs.renderFile(navigation, {
      authenticatedUser: { role: "trainer" },
    });

    expect(html).toMatch(/<summary>Manage<\/summary>/);
    expect(html).toContain('<a href="/sessions">Sessions</a>');
    for (const [href] of manageLinks.slice(1)) {
      expect(html).not.toContain(`href="${href}"`);
    }
  });

  test.each(["member", undefined])(
    "hides Manage and management links for %s",
    async (role) => {
      const html = await ejs.renderFile(navigation, {
        authenticatedUser: role ? { role } : undefined,
      });

      expect(html).not.toContain("<summary>Manage</summary>");
      for (const [href] of manageLinks) {
        expect(html).not.toContain(`href="${href}"`);
      }
    },
  );
});
