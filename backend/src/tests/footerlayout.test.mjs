import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "@jest/globals";

const stylesheet = readFileSync(
  new URL("../public/css/style.css", import.meta.url),
  "utf8",
);
const footerTemplate = readFileSync(
  new URL("../views/partials/footer.ejs", import.meta.url),
  "utf8",
);
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
});
