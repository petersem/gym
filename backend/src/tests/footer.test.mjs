import { describe, expect, test } from "@jest/globals";
import ejs from "ejs";
import { fileURLToPath } from "node:url";

const footer = fileURLToPath(
  new URL("../views/partials/footer.ejs", import.meta.url),
);

describe("footer links", () => {
  test.each(["admin", "trainer", "member"])(
    "only shows the JSDoc link to admins (role: %s)",
    async (role) => {
      const html = await ejs.renderFile(footer, {
        authenticatedUser: { role },
      });

      expect(html.includes('href="/docs/index.html"')).toBe(role === "admin");
      expect(html).toContain('href="/privacy-policy.html"');
    },
  );

  test.each([{}, { authenticatedUser: undefined }, { authenticatedUser: null }])(
    "hides the JSDoc link without an authenticated user (%p)",
    async (locals) => {
      const html = await ejs.renderFile(footer, locals);

      expect(html).not.toContain('href="/docs/index.html"');
      expect(html).toContain('href="/privacy-policy.html"');
    },
  );
});
