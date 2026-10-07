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
  test.each(["admin", "trainer", "member", undefined])(
    "renders only first-level menu items for %s",
    async (role) => {
      const html = await ejs.renderFile(navigation, {
        authenticatedUser: role ? { role } : undefined,
      });
      expect(html).not.toMatch(/<(?:details|summary|ul)\b/);
      expect(html).not.toContain("Manage");
    },
  );

  test.each(["admin", "trainer", "member", undefined])(
    "hides the public Blogs link only for admins (%s)",
    async (role) => {
      const html = await ejs.renderFile(navigation, {
        authenticatedUser: role ? { role } : undefined,
      });
      expect(html.includes('href="/blogs"')).toBe(role !== "admin");
      expect(html.includes('href="/manage/blogs"')).toBe(role === "admin");
    },
  );

  test.each(["member", "admin", "trainer", undefined])(
    "shows Bookings only to members when role is %s",
    async (role) => {
      const html = await ejs.renderFile(navigation, {
        authenticatedUser: role ? { role } : undefined,
      });
      expect(html.includes('href="/bookings"')).toBe(role === "member");
      expect(html.includes('href="/timetable"')).toBe(!["admin", "trainer"].includes(role));
    },
  );

  test("shows all management links at the first level to admins", async () => {
    const html = await ejs.renderFile(navigation, {
      authenticatedUser: { role: "admin" },
    });

    for (const [href, label] of manageLinks) {
      expect(html).toContain(`<a href="${href}">${label}</a>`);
    }
  });

  test("shows trainers only the sessions management link", async () => {
    const html = await ejs.renderFile(navigation, {
      authenticatedUser: { role: "trainer" },
    });

    expect(html).toContain('<a href="/sessions">Sessions</a>');
    for (const [href] of manageLinks.slice(1)) {
      expect(html).not.toContain(`href="${href}"`);
    }
  });

  test.each(["member", undefined])(
    "hides management links for %s",
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
