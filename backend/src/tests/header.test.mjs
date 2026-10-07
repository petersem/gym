import { describe, expect, test } from "@jest/globals";
import ejs from "ejs";
import { fileURLToPath } from "node:url";

const header = fileURLToPath(
  new URL("../views/partials/header.ejs", import.meta.url),
);

describe("user badge", () => {
  test("uses decorative sun and moon icons with an accessible theme switch", async () => {
    const html = await ejs.renderFile(header, { authenticatedUser: undefined });
    expect(html.match(/class="theme-toggle-icon"/g)).toHaveLength(2);
    expect(html.match(/aria-hidden="true" focusable="false"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Use dark theme"');
    expect(html).not.toContain("<span>Light</span>");
    expect(html).not.toContain("<span>Dark</span>");
  });

  test.each([
    ["alex", "smith", "AS"],
    ["  alex ", " smith ", "AS"],
    ["Alex", "", "A"],
  ])(
    "provides uppercase initials for %s %s",
    async (first_name, last_name, initials) => {
      const html = await ejs.renderFile(header, {
        authenticatedUser: { first_name, last_name, role: "member" },
      });
      expect(html).toContain(
        `<span class="user-initials" hidden>${initials}</span>`,
      );
      expect(html).toContain(`aria-label="${first_name} ${last_name}, member"`);
      expect(html).toContain(`title="${first_name} ${last_name}, member"`);
      expect(html).toContain('class="user-full-name"');
    },
  );

  test("does not render a badge for guests", async () => {
    const html = await ejs.renderFile(header, { authenticatedUser: undefined });
    expect(html).not.toContain('class="user-full-name"');
    expect(html).not.toContain('class="user-initials"');
  });
});
