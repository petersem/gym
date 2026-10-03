import { describe, expect, test } from "@jest/globals";
import ejs from "ejs";
import { fileURLToPath } from "node:url";

const template = fileURLToPath(
  new URL("../views/partials/form-field.ejs", import.meta.url),
);
const renderSelect = (value, formValues = {}) =>
  ejs.renderFile(template, {
    field: "manager",
    id: "manager",
    label: "Manager",
    type: "select",
    value,
    formValues,
    formErrors: {},
    options: [{ value: 1, label: "Ada" }],
  });

describe("form dropdown placeholders", () => {
  test.each([0, "0", "", null, undefined])(
    "shows an empty selection placeholder for %j",
    async (value) => {
      const html = await renderSelect(value);
      expect(html).toContain(
        '<option value="" selected>Select an option</option>',
      );
      expect(html).not.toContain("Invalid selection");
    },
  );

  test("treats submitted zero as unselected", async () => {
    const html = await renderSelect(1, { manager: "0" });
    expect(html).toContain(
      '<option value="" selected>Select an option</option>',
    );
    expect(html).not.toContain("Invalid selection (0)");
  });

  test("preserves valid selections", async () => {
    const html = await renderSelect("1");
    expect(html).toContain('<option value="1" selected>Ada</option>');
    expect(html).not.toContain("Select an option");
  });

  test("still displays genuinely unknown submitted selections", async () => {
    const html = await renderSelect(1, { manager: "99" });
    expect(html).toContain(
      '<option value="99" selected>Invalid selection (99)</option>',
    );
  });
});

describe("password fields after failed submissions", () => {
  const renderPassword = (keep) =>
    ejs.renderFile(template, {
      field: "password",
      id: "password",
      label: "Password",
      type: "password",
      value: "$2b$10$storedhash",
      keep,
      formValues: {},
      formErrors: { firstName: "First name must contain 1-45 characters." },
      hasFormFeedback: true,
    });

  test("clears the password by default", async () => {
    expect(await renderPassword(undefined)).not.toContain("storedhash");
  });

  test("refills the stored hash when keep is set", async () => {
    expect(await renderPassword(true)).toContain('value="$2b$10$storedhash"');
  });
});
