import { readdirSync, readFileSync } from "node:fs";
import ejs from "ejs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

const stylesheet = readFileSync(
  new URL("../public/css/style.css", import.meta.url),
  "utf8",
);
const footerTemplate = readFileSync(
  new URL("../views/partials/footer.ejs", import.meta.url),
  "utf8",
);
const blogTemplatePath = new URL(
  "../views/blog_management.ejs",
  import.meta.url,
);
const blogTemplate = readFileSync(blogTemplatePath, "utf8");
const pageTemplates = readdirSync(new URL("../views/", import.meta.url))
  .filter((file) => file.endsWith(".ejs"))
  .map((file) =>
    readFileSync(new URL(`../views/${file}`, import.meta.url), "utf8"),
  );

const ruleFor = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1] ??
    ""
  );
};

// Checks the shared template and CSS contract without launching a browser.
describe("shared footer layout", () => {
  test("keeps the footer at the viewport bottom on short pages", () => {
    expect(footerTemplate).toMatch(/class="site-footer"/);
    expect(ruleFor("body")).toMatch(/display:\s*flex/);
    expect(ruleFor("body")).toMatch(/min-height:\s*100vh/);
    expect(ruleFor("body")).toMatch(/flex-direction:\s*column/);
    expect(ruleFor("main")).toMatch(/display:\s*flex/);
    expect(ruleFor("main")).toMatch(/flex:\s*1 0 auto/);
    expect(ruleFor("main")).toMatch(/flex-direction:\s*column/);
    expect(ruleFor(".site-footer")).toMatch(/margin-top:\s*auto/);
    expect(
      pageTemplates.every((template) =>
        template.includes("partials/footer.ejs"),
      ),
    ).toBe(true);
  });

  test("only owners and admins can open a post from its title", () => {
    const renderBlogPage = (
      authenticatedUser,
      selectedBlog = { id: null, title: "", content: "", user_id: null },
    ) =>
      ejs.render(
        blogTemplate,
        {
          authenticatedUser,
          blogs: [
            {
              id: 42,
              title: "Training notes",
              content: "A short post.",
              user_id: 7,
              created: "2026-10-02T10:00:00Z",
            },
          ],
          users: [{ id: 7, first_name: "Post", last_name: "Owner" }],
          selectedBlog,
          selectedSearchTerm: "",
          selectedSortBy: "created",
          selectedSortDir: "desc",
          selectedPage: 1,
          totalPages: 1,
          role: "",
        },
        { filename: fileURLToPath(blogTemplatePath) },
      );

    const ownerPage = renderBlogPage({ id: 7, role: "member" });
    const adminPage = renderBlogPage({ id: 8, role: "admin" });
    const otherUserPage = renderBlogPage({ id: 8, role: "member" });

    expect(ownerPage).toMatch(
      /<a href="\/blogs\/42">\s*Training notes\s*<\/a>/,
    );
    expect(adminPage).toMatch(
      /<a href="\/blogs\/42">\s*Training notes\s*<\/a>/,
    );
    expect(otherUserPage).toMatch(/<span>\s*Training notes\s*<\/span>/);
    expect(otherUserPage).not.toMatch(/<a href="\/blogs\/42">/);
  });

  test("shows a clear-changes button only when editing a post", () => {
    const authenticatedUser = { id: 7, role: "member" };
    const editPage = ejs.render(
      blogTemplate,
      {
        authenticatedUser,
        blogs: [],
        users: [{ id: 7, first_name: "Post", last_name: "Owner" }],
        selectedBlog: {
          id: 42,
          title: "Training notes",
          content: "A short post.",
          user_id: 7,
          created: "2026-10-02T10:00:00Z",
        },
        selectedSearchTerm: "",
        selectedSortBy: "created",
        selectedSortDir: "desc",
        selectedPage: 1,
        totalPages: 1,
        role: "",
      },
      { filename: fileURLToPath(blogTemplatePath) },
    );
    const createPage = ejs.render(
      blogTemplate,
      {
        authenticatedUser,
        blogs: [],
        users: [],
        selectedBlog: { id: null, title: "", content: "", user_id: null },
        selectedSearchTerm: "",
        selectedSortBy: "created",
        selectedSortDir: "desc",
        selectedPage: 1,
        totalPages: 1,
        role: "",
      },
      { filename: fileURLToPath(blogTemplatePath) },
    );

    expect(editPage).toContain(
      '<a class="btn btn-outline" href="/blogs">Clear</a>',
    );
    expect(createPage).not.toContain(">Clear</a>");
  });
});
