import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import { describe, expect, test } from "@jest/globals";

const templatePath = fileURLToPath(
  new URL("../views/partials/nav.ejs", import.meta.url),
);
const template = readFileSync(templatePath, "utf8");
const stylesheet = readFileSync(
  new URL("../public/css/style.css", import.meta.url),
  "utf8",
);

describe("responsive primary navigation", () => {
  test.each([
    [
      undefined,
      ["/", "/bookings", "/blogs", "/authenticate", "/authenticate/register"],
    ],
    [{ role: "member" }, ["/", "/bookings", "/blogs", "/authenticate/logout"]],
    [
      { role: "trainer" },
      ["/", "/bookings", "/sessions", "/blogs", "/authenticate/logout"],
    ],
    [
      { role: "admin" },
      [
        "/",
        "/bookings",
        "/sessions",
        "/activities",
        "/locations",
        "/users",
        "/blogs",
        "/authenticate/logout",
      ],
    ],
  ])("preserves role-based links in both layouts for %p", (user, expected) => {
    const html = ejs.render(
      template,
      { authenticatedUser: user },
      { filename: templatePath },
    );
    const menus = [...html.matchAll(/<ul\b[^>]*>([\s\S]*?)<\/ul>/g)];

    expect(menus).toHaveLength(2);
    for (const [, menu] of menus) {
      expect(
        [...menu.matchAll(/href="([^"]+)"/g)].map((match) => match[1]),
      ).toEqual(expected);
    }
    expect(html).toMatch(/<details class="mobile-menu">/);
    expect(html).toMatch(/<summary class="mobile-menu-toggle">/);
    expect(html).toMatch(/<span>Menu<\/span>/);
    expect(html).not.toMatch(/<script\b|\bon\w+=|\baria-expanded=/);
  });

  test("shows the native toggle only at the existing mobile breakpoint", () => {
    const [desktop, mobile] = stylesheet.split(
      "@media screen and (max-width: 760px)",
    );
    expect(desktop).toMatch(/\.mobile-menu\s*\{\s*display:\s*none/);
    expect(mobile).toMatch(/\.mobile-menu\s*\{\s*display:\s*block/);
    expect(mobile).toMatch(/\.site-menu\.desktop-menu\s*\{\s*display:\s*none/);
    expect(mobile).toMatch(
      /\.mobile-menu \.site-menu\s*\{\s*flex-direction:\s*column/,
    );
  });
});
