import ejs from "ejs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

describe("blog sort direction accessibility", () => {
  test.each(["asc", "desc"])(
    "labels the dropdown and preserves the %s selection",
    async (selectedSortDir) => {
      const html = await ejs.renderFile(
        fileURLToPath(new URL("../views/blog_management.ejs", import.meta.url)),
        {
          authenticatedUser: undefined,
          role: "",
          blogs: [],
          users: [],
          selectedSearchTerm: "",
          selectedSortBy: "created",
          selectedSortDir,
          selectedPage: 1,
          totalPages: 1,
        },
      );

      expect(html).toContain('<label for="sort-dir">Sort direction</label>');
      const dropdowns = [
        ...html.matchAll(
          /<select\b[^>]*\bid="sort-dir"[^>]*>([\s\S]*?)<\/select>/g,
        ),
      ];
      expect(dropdowns).toHaveLength(1);
      expect(dropdowns[0][0]).toContain('name="sort_dir"');
      expect(dropdowns[0][0]).toContain('onchange="this.form.submit()"');
      expect(dropdowns[0][1]).toMatch(
        new RegExp(`<option value="${selectedSortDir}"\\s+selected\\s*>`),
      );
    },
  );
});
