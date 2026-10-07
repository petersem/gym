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
    options: [{ value: 1, label: "Fred" }],
  });

test("registration shows email and phone examples without prefilling values", async () => {
  const html = await ejs.renderFile(
    fileURLToPath(new URL("../views/register.ejs", import.meta.url)),
    { authenticatedUser: undefined },
  );
  expect(html).toMatch(
    /name="email"[^>]*value=""[^>]*placeholder="e.g. alex@example.com"/,
  );
  expect(html).toMatch(
    /name="phone"[^>]*value=""[^>]*placeholder="e.g. 0412 345 678"/,
  );
});

describe("form dropdown placeholders", () => {
  test.each([true, false])(
    "sorts options by displayed label only when enabled: %s",
    async (sortOptions) => {
      const options = [
        { value: 2, label: "Zulu, Alex" },
        { value: 3, label: "Alpha, Zoe" },
        { value: 1, label: "Alpha, Ben" },
      ];
      const html = await ejs.renderFile(template, {
        field: "userId",
        id: "user-id",
        label: "User",
        type: "select",
        options,
        sortOptions,
        value: 3,
        formValues: { userId: "2" },
      });
      const labels = [
        ...html.matchAll(/<option\b[^>]*>([^<]*)<\/option>/g),
      ].map((match) => match[1]);
      expect(labels).toEqual(
        sortOptions
          ? ["Alpha, Ben", "Alpha, Zoe", "Zulu, Alex"]
          : ["Zulu, Alex", "Alpha, Zoe", "Alpha, Ben"],
      );
      expect(html).toContain('<option value="2" selected>Zulu, Alex</option>');
      expect(options.map((option) => option.value)).toEqual([2, 3, 1]);
    },
  );

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
    expect(html).toContain('<option value="1" selected>Fred</option>');
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

  describe("required field indicators", () => {
    test.each(["text", "select", "textarea"])(
      "marks required %s fields without adding browser validation",
      async (type) => {
        const html = await ejs.renderFile(template, {
          field: "example",
          id: "example",
          label: "Example",
          type,
          requiredField: true,
          options: [],
        });
        expect(html).toContain('<label for="example">Example *</label>');
        expect(html).not.toMatch(/\srequired(?:\s|=|>)/);
      },
    );

    test.each([false, undefined])(
      "does not mark optional fields when requiredField is %s",
      async (requiredField) => {
        const html = await ejs.renderFile(template, {
          field: "dob",
          id: "dob",
          label: "Date of birth",
          requiredField,
        });
        expect(html).toContain('<label for="dob">Date of birth</label>');
      },
    );
  });

  test("clears the password by default", async () => {
    expect(await renderPassword(undefined)).not.toContain("storedhash");
  });

  test("refills the stored hash when keep is set", async () => {
    expect(await renderPassword(true)).toContain('value="$2b$10$storedhash"');
  });
});
