import { describe, expect, jest, test } from "@jest/globals";
import {
  runFormValidation,
  formValidation,
} from "../helpers/formValidation.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

const user = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "password123",
  phone: "+61 (2) 1234-5678",
  dob: "",
};
const validForms = {
  login: { username: user.email, password: "short" },
  register: user,
  users: { ...user, role: "member", deleted: "0", authenticationKey: "" },
  locations: {
    name: "Gym",
    phone: user.phone,
    email: user.email,
    street: "1 Main Street",
    suburb: "Sydney",
    postcode: "2000",
    manager: "1",
  },
  activities: { name: "Yoga", description: "Stretching", updatedBy: "1" },
  blogs: { title: "News", content: "New classes" },
  sessions: {
    title: "Yoga",
    activityId: "1",
    locationId: "2",
    trainerId: "3",
    date: "2099-10-03",
    time: "10:30",
  },
  bookings: { sessionId: "1", userId: "2" },
};
const managementForms = Object.keys(validForms).filter(
  (form) => !["login", "register"].includes(form),
);

const validate = async (form, body, params = {}) => {
  const req = { body: { ...body }, params };
  const res = {
    status: jest.fn().mockReturnThis(),
    render: jest.fn(),
    redirect: jest.fn(),
  };
  const valid = await runFormValidation(form, req, res);
  return { req, res, valid };
};

describe("form validation", () => {
  test("passes missing-session and session-save failures to error handling", async () => {
    for (const session of [
      undefined,
      { save: (callback) => callback(new Error("Session store unavailable")) },
    ]) {
      const req = { body: {}, originalUrl: "/authenticate", session };
      const next = jest.fn();
      const res = { redirect: jest.fn() };
      await formValidation.login[0].run(req);
      formValidation.login.at(-1)(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.redirect).not.toHaveBeenCalled();
    }
  });

  test("rethrows errors passed to next by the test helper", async () => {
    const req = {
      body: {},
      originalUrl: "/authenticate",
      session: { save: (callback) => callback(new Error("store down")) },
    };
    await expect(runFormValidation("login", req, {})).rejects.toThrow(
      "store down",
    );
  });

  test("refuses to redirect outside the form's own route", async () => {
    const req = { body: {}, params: {}, originalUrl: "/elsewhere" };
    await expect(runFormValidation("activities", req, {})).rejects.toThrow(
      "Validation used outside a supported form route.",
    );
  });

  test("returns to the base path when the URL ID is not a record ID", async () => {
    const { valid, res } = await validate(
      "activities",
      { ...validForms.activities, action: "update" },
      { id: "abc" },
    );
    expect(valid).toBe(false);
    expect(res.redirect).toHaveBeenCalledWith(
      303,
      "/activities#form-validation",
    );
  });

  test.each([
    ["activities", "deleted"],
    ["activities", "updatedBy"],
    ["users", "deleted"],
    ["blogs", "userId"],
    ["blogs", "deleted"],
    ["blogs", "updatedBy"],
    ["locations", "deleted"],
  ])("checks the optional %s %s number field", async (form, field) => {
    const body = { ...validForms[form], action: "create" };
    expect((await validate(form, { ...body, [field]: 1 })).valid).toBe(true);
    const { valid, req } = await validate(form, { ...body, [field]: 1.5 });
    expect(valid).toBe(false);
    expect(
      req.session.formFeedback[req.originalUrl].errors[field],
    ).toBeDefined();
  });

  test("treats a blank session date as missing", async () => {
    const { valid, req } = await validate("sessions", {
      ...validForms.sessions,
      action: "create",
      date: "",
    });
    expect(valid).toBe(false);
    expect(req.session.formFeedback[req.originalUrl].errors.date).toBe(
      "Date must be a date.",
    );
  });

  test("rejects a stored-looking hash when the user cannot be loaded", async () => {
    const getById = jest
      .spyOn(UsersModel, "getById")
      .mockRejectedValue("not found");
    try {
      const { valid } = await validate(
        "users",
        {
          ...validForms.users,
          action: "update",
          password: `$2b$10$${"a".repeat(53)}`,
        },
        { id: "1" },
      );
      expect(valid).toBe(false);
    } finally {
      getById.mockRestore();
    }
  });

  test("does not store passwords or authentication keys in feedback", async () => {
    const { req } = await validate("users", {
      ...validForms.users,
      action: "create",
      email: "bad",
      password: "private-password",
      authenticationKey: "private-key",
    });
    const state = JSON.stringify(req.session.formFeedback);
    expect(state).not.toContain("private-password");
    expect(state).not.toContain("private-key");
  });
  test.each(Object.keys(validForms))(
    "accepts a valid %s form",
    async (form) => {
      const result = await validate(form, {
        ...validForms[form],
        ...(managementForms.includes(form) ? { action: "create" } : {}),
      });
      expect(result.valid).toBe(true);
      expect(result.res.render).not.toHaveBeenCalled();
    },
  );

  test.each(Object.keys(validForms))(
    "rejects an empty %s form",
    async (form) => {
      const { valid, res, req } = await validate(form, {});
      expect(valid).toBe(false);
      expect(res.redirect).toHaveBeenCalledWith(
        303,
        `${req.originalUrl}#form-validation`,
      );
      expect(
        Object.keys(req.session.formFeedback[req.originalUrl].errors).length,
      ).toBeGreaterThan(0);
    },
  );

  test.each(managementForms)(
    "validates update and delete IDs for %s",
    async (form) => {
      for (const action of ["update", "delete"]) {
        for (const id of [
          undefined,
          "0",
          "-1",
          "1.5",
          "abc",
          "2147483648",
          "1e2",
        ]) {
          const { valid } = await validate(
            form,
            { ...validForms[form], action },
            id === undefined ? {} : { id },
          );
          expect(valid).toBe(false);
        }
        const { valid } = await validate(
          form,
          { ...validForms[form], action },
          { id: "1" },
        );
        expect(valid).toBe(true);
      }
    },
  );

  test.each(managementForms)("allows ID-only deletion for %s", async (form) => {
    expect(
      (await validate(form, { action: "delete" }, { id: "1" })).valid,
    ).toBe(true);
    expect(
      (await validate(form, { action: "destroy" }, { id: "1" })).valid,
    ).toBe(false);
    expect(
      (
        await validate(
          form,
          { ...validForms[form], action: "create" },
          { id: "bad" },
        )
      ).valid,
    ).toBe(false);
  });

  test.each([
    ["register", "firstName", 45],
    ["register", "lastName", 45],
    ["register", "email", 100],
    ["locations", "email", 45],
    ["locations", "name", 100],
    ["locations", "street", 100],
    ["locations", "suburb", 100],
    ["activities", "name", 45],
    ["activities", "description", 150],
    ["blogs", "title", 100],
    ["blogs", "content", 250],
    ["sessions", "title", 200],
  ])("enforces the %s %s column limit", async (form, field, max) => {
    const value = (length) => {
      if (field !== "email") {
        return "a".repeat(length);
      }
      const localLength = Math.min(64, length - 12);
      return `${"a".repeat(localLength)}@${"b".repeat(length - localLength - 5)}.com`;
    };
    const body = { ...validForms[form], action: "create" };
    expect((await validate(form, { ...body, [field]: value(max) })).valid).toBe(
      true,
    );
    expect(
      (await validate(form, { ...body, [field]: value(max + 1) })).valid,
    ).toBe(false);
  });

  test.each([
    ["register", { firstName: "  " }],
    ["register", { email: "not-email" }],
    ["register", { phone: "letters" }],
    ["register", { phone: "---" }],
    ["register", { phone: "1".repeat(21) }],
    ["register", { dob: "2025-02-29" }],
    ["register", { dob: "2026-13-01" }],
    ["users", { role: "superadmin" }],
    ["users", { role: ["member"] }],
    ["users", { deleted: "2" }],
    ["users", { authenticationKey: "a".repeat(37) }],
    ["locations", { postcode: "10000" }],
    ["locations", { manager: "0" }],
    ["activities", { updatedBy: "-1" }],
    ["bookings", { sessionId: "0" }],
    ["bookings", { userId: "1.2" }],
    ["sessions", { date: "2026-02-30" }],
    ["sessions", { time: "24:00" }],
    ["sessions", { time: "10:60" }],
    ["sessions", { time: "10:00:60" }],
    ["sessions", { time: "0:30 AM" }],
    ["sessions", { time: "13:00 PM" }],
  ])("rejects invalid %s fields: %j", async (form, fields) => {
    expect(
      (
        await validate(form, {
          ...validForms[form],
          action: "create",
          ...fields,
        })
      ).valid,
    ).toBe(false);
  });

  test.each([
    "0412 345 678",
    "+61 412 345 678",
    "(02) 1234-5678",
    "+61 2 1234 5678",
    "13 12 34",
    "1300 123 456",
    "1800 123 456",
  ])("accepts Australian user phone number %s", async (phone) => {
    for (const action of ["create", "update"]) {
      expect(
        (
          await validate(
            "users",
            { ...validForms.users, action, phone },
            action === "update" ? { id: "1" } : {},
          )
        ).valid,
      ).toBe(true);
    }
  });

  test.each([
    "555-0100",
    "1234567890",
    "+1 212 555 0100",
    "0412 345 67",
    "0912 345 678",
    "+61 (02) 1234-5678",
  ])("rejects invalid Australian user phone number %s", async (phone) => {
    for (const action of ["create", "update"]) {
      expect(
        (
          await validate(
            "users",
            { ...validForms.users, action, phone },
            action === "update" ? { id: "1" } : {},
          )
        ).valid,
      ).toBe(false);
    }
  });

  test.each(["00:00", "23:59:59", "1:30", "12:00 AM", "1:30 pm"])(
    "accepts supported session time %s",
    async (time) => {
      expect(
        (
          await validate("sessions", {
            ...validForms.sessions,
            action: "create",
            time,
          })
        ).valid,
      ).toBe(true);
    },
  );

  test("trims text, preserves passwords, and accepts a blank or leap-day DOB", async () => {
    const password = " password ";
    const { req, valid } = await validate("register", {
      ...user,
      firstName: " Ada ",
      password,
    });
    expect(valid).toBe(true);
    expect(req.body.firstName).toBe("Ada");
    expect(req.body.password).toBe(password);
    expect(req.body.dob).toBeNull();
    expect(
      (await validate("register", { ...user, dob: "2024-02-29" })).valid,
    ).toBe(true);
  });

  test.each([
    ["", null],
    ["2024-02-29", "2024-02-29"],
  ])("accepts date of birth %j in user management", async (dob, expected) => {
    const { req, valid } = await validate("users", {
      ...validForms.users,
      action: "create",
      dob,
    });
    expect(valid).toBe(true);
    expect(req.body.dob).toBe(expected);
  });

  test("enforces new password limits in bytes without echoing the password", async () => {
    for (const password of [
      "short",
      "a".repeat(73),
      "\u00e9".repeat(37),
      ["password123"],
      { value: "password123" },
    ]) {
      const { valid, req } = await validate("register", { ...user, password });
      expect(valid).toBe(false);
      const feedback = req.session.formFeedback[req.originalUrl];
      expect(JSON.stringify(feedback)).not.toContain("password123");
      expect(feedback.values).not.toHaveProperty("password");
    }
    expect(
      (await validate("register", { ...user, password: "a".repeat(72) })).valid,
    ).toBe(true);
    expect(
      (await validate("register", { ...user, password: "\u00e9".repeat(36) }))
        .valid,
    ).toBe(true);
  });

  test("accepts the unchanged stored password hash on user updates", async () => {
    const password = `$2b$10$${"a".repeat(53)}`;
    const getById = jest
      .spyOn(UsersModel, "getById")
      .mockResolvedValue({ password });
    try {
      expect(
        (
          await validate(
            "users",
            { ...validForms.users, action: "update", password },
            { id: "1" },
          )
        ).valid,
      ).toBe(true);
      expect(getById).toHaveBeenCalledWith("1");
    } finally {
      getById.mockRestore();
    }
  });

  test("flags an unchanged stored password when other user fields are invalid", async () => {
    const password = `$2b$10$${"a".repeat(53)}`;
    const getById = jest
      .spyOn(UsersModel, "getById")
      .mockResolvedValue({ password });
    try {
      const { valid, req } = await validate(
        "users",
        { ...validForms.users, action: "update", firstName: "", password },
        { id: "1" },
      );
      expect(valid).toBe(false);
      const feedback = req.session.formFeedback[req.originalUrl];
      expect(feedback.errors).not.toHaveProperty("password");
      expect(feedback.values.passwordUnchanged).toBe("1");
      expect(JSON.stringify(feedback)).not.toContain(password);
    } finally {
      getById.mockRestore();
    }
  });

  test("rejects a bcrypt hash that does not match the stored password", async () => {
    const getById = jest
      .spyOn(UsersModel, "getById")
      .mockResolvedValue({ password: `$2b$10$${"a".repeat(53)}` });
    try {
      const { valid, req } = await validate(
        "users",
        {
          ...validForms.users,
          action: "update",
          password: `$2b$10$${"b".repeat(53)}`,
        },
        { id: "1" },
      );
      expect(valid).toBe(false);
      expect(
        req.session.formFeedback[req.originalUrl].errors.password,
      ).toBeDefined();
    } finally {
      getById.mockRestore();
    }
  });

  test.each(["firstName", "email", "phone", "dob"])(
    "rejects non-string %s inputs",
    async (field) => {
      for (const value of [["Ada"], { value: "Ada" }, false, 42]) {
        expect(
          (await validate("register", { ...user, [field]: value })).valid,
        ).toBe(false);
      }
    },
  );

  test("validates both ID naming conventions and their types", async () => {
    const body = {
      action: "create",
      title: "Yoga",
      activity_id: "1",
      location_id: "2",
      trainer_id: "3",
      date: "2099-10-03",
      time: "10:30",
    };
    expect((await validate("sessions", body)).valid).toBe(true);
    for (const value of [["1"], { id: "1" }, true, "1e2"]) {
      expect(
        (await validate("sessions", { ...body, activity_id: value })).valid,
      ).toBe(false);
    }
    expect(
      (
        await validate("bookings", {
          action: "create",
          session_id: "1",
          user_id: "2",
        })
      ).valid,
    ).toBe(true);
    expect(
      (
        await validate("users", {
          ...validForms.users,
          authenticationKey: undefined,
          authentication_key: "a".repeat(37),
          action: "create",
        })
      ).valid,
    ).toBe(false);
    expect(
      (
        await validate("activities", {
          ...validForms.activities,
          updatedBy: undefined,
          updated_by: "bad",
          action: "create",
        })
      ).valid,
    ).toBe(false);
  });
});
