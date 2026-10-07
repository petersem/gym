import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import express from "express";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { BookingManagementController } from "../controllers/BookingManagementController.mjs";
import { BookingsModel } from "../models/BookingsModel.mjs";
import { SessionsModel } from "../models/SessionsModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { LocationModel } from "../models/LocationModel.mjs";

let server;
let baseUrl;
const sessions = [
  {
    id: 1,
    trainer_id: 7,
    location_id: 1,
    title: "Own session",
    date: "2026-10-10",
    time: "09:00:00",
  },
  {
    id: 2,
    trainer_id: 8,
    location_id: 2,
    title: "Other session",
    date: "2026-10-11",
    time: "10:00:00",
  },
];
const bookings = [
  { id: 1, session_id: 1, user_id: 10, created: "2026-10-01" },
  { id: 2, session_id: 2, user_id: 11, created: "2026-10-02" },
];
beforeAll(async () => {
  const app = express();
  app.set("view engine", "ejs");
  app.set("views", fileURLToPath(new URL("../views", import.meta.url)));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    const role = req.headers["x-test-role"];
    req.authenticatedUser = role ? { id: 7, role } : undefined;
    res.locals.authenticatedUser = req.authenticatedUser;
    req.session = { save: (callback) => callback() };
    next();
  });
  app.use("/manage/bookings", BookingManagementController.routes);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  jest.spyOn(LocationModel, "getAll").mockResolvedValue([
    { id: 1, name: "Main" },
    { id: 2, name: "West" },
  ]);
  jest.spyOn(BookingsModel, "getAll").mockResolvedValue(bookings);
  jest.spyOn(SessionsModel, "getAll").mockResolvedValue(sessions);
  jest.spyOn(UsersModel, "getAll").mockResolvedValue([
    { id: 10, role: "member", first_name: "Alex", last_name: "Member" },
    { id: 11, role: "member", first_name: "Sam", last_name: "Member" },
    { id: 7, role: "trainer", first_name: "Test", last_name: "Trainer" },
    { id: 8, role: "trainer", first_name: "Other", last_name: "Coach" },
  ]);
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
const get = (path = "", role = "admin") =>
  fetch(`${baseUrl}/manage/bookings${path}`, {
    headers: role ? { "x-test-role": role } : {},
  });
const post = (
  action,
  path = "",
  role = "admin",
  fields = { sessionId: "1", userId: "11" },
) =>
  fetch(`${baseUrl}/manage/bookings${path}`, {
    method: "POST",
    headers: role ? { "x-test-role": role } : {},
    body: new URLSearchParams({ action, ...fields }),
    redirect: "manual",
  });

describe("staff booking management", () => {
  test.each(["", "?trainer_id=8"])(
    "defaults trainer dropdowns to the logged-in trainer without All (%s)",
    async (query) => {
      const html = await (await get(`/1${query}`, "trainer")).text();
      for (const id of ["trainer-filter", "editor-trainer"]) {
        const select = html.match(
          new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`),
        )[1];
        expect(select.match(/<option\b/g)).toHaveLength(1);
        expect(select).toMatch(/value="7"\s+selected>Trainer, Test<\/option>/);
        expect(select).not.toContain(">All</option>");
      }
      const table = html.match(/<table[\s\S]*?<\/table>/)[0];
      expect(table).toContain("Own session");
      expect(table).not.toContain(">Trainer</a>");
      expect(table).not.toContain("Other session");
    },
  );
  test.each([
    ["", true, true],
    ["?trainer_id=7", false, true],
    ["?location_id=1", true, false],
    ["?trainer_id=7&location_id=1", false, false],
  ])(
    "shows conditional sortable columns for %s",
    async (query, trainer, location) => {
      const html = await (await get(query)).text();
      const table = html.match(/<table[\s\S]*?<\/table>/)[0];
      const headers = [
        ...table.matchAll(/class="sort-link"[^>]*>([^<]+)<\/a>/g),
      ].map((match) => match[1]);
      expect(headers.slice(0, 3)).toEqual([
        "Session",
        "Member",
        "Session date/time",
      ]);
      const firstRow = table.match(/<tbody>\s*<tr>([\s\S]*?)<\/tr>/)[1];
      expect(firstRow).toMatch(
        /<\/a><\/td>\s*<td>Member, Alex<\/td>\s*<td>10\/10\/2026 9:00am<\/td>/,
      );
      expect(table.includes(">Trainer</a>")).toBe(trainer);
      expect(table.includes(">Location</a>")).toBe(location);
      if (trainer) expect(table).toContain("<td>Trainer, Test</td>");
      if (location) expect(table).toContain("<td>Main</td>");
      const emptyHtml = await (
        await get(`${query}${query ? "&" : "?"}search_term=absent`)
      ).text();
      expect(emptyHtml).toContain(
        `colspan="${3 + Number(trainer) + Number(location)}"`,
      );
    },
  );

  test.each([
    ["trainer", "asc", [2, 1]],
    ["trainer", "desc", [1, 2]],
    ["location", "asc", [1, 2]],
    ["location", "desc", [2, 1]],
  ])("sorts the %s column %s", async (column, direction, expected) => {
    const html = await (
      await get(`?sort_by=${column}&sort_dir=${direction}`)
    ).text();
    const table = html.match(/<table[\s\S]*?<\/table>/)[0];
    const ids = [...table.matchAll(/href="\/manage\/bookings\/(\d+)\?/g)].map(
      (match) => Number(match[1]),
    );
    expect(ids).toEqual(expected);
    expect(table).toContain(
      `aria-sort="${direction === "asc" ? "ascending" : "descending"}"`,
    );
    expect(table).toContain(
      `sort_by=${column}&amp;trainer_id=all&amp;location_id=all&amp;sort_dir=${direction === "asc" ? "desc" : "asc"}`,
    );
  });

  test("prefills edit filters from the existing session and leaves create unchanged", async () => {
    const html = await (await get("/1")).text();
    const select = (id) =>
      html.match(
        new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`),
      )[1];
    expect(select("editor-trainer")).toContain(
      '<option value="7" selected>Trainer, Test</option>',
    );
    expect(select("editor-location")).toContain(
      '<option value="1" selected>Main</option>',
    );
    expect(select("editor-date-time")).toContain(
      '<option value="2026-10-10 09:00" selected>10/10/2026 9:00am</option>',
    );
    expect(select("session-id")).toContain('<option value="1" selected>');
    for (const id of [
      "editor-trainer",
      "editor-location",
      "editor-date-time",
    ]) {
      expect(select(id)).toContain('<option value="">All</option>');
    }
    expect(await (await get()).text()).not.toContain('id="editor-trainer"');
    const trainerHtml = await (await get("/1", "trainer")).text();
    expect(
      trainerHtml.match(
        /<select id="editor-trainer"[^>]*>([\s\S]*?)<\/select>/,
      )[1],
    ).not.toContain("Coach, Other");
    expect(trainerHtml).not.toContain('value="2026-10-11 10:00"');
  });

  test("edit filters combine, preserve matching selections, and require explicit replacement", async () => {
    SessionsModel.getAll.mockResolvedValue([
      ...sessions,
      { ...sessions[0], id: 3, trainer_id: 8 },
      { ...sessions[0], id: 4, location_id: 2 },
    ]);
    const html = await (await get("/1")).text();
    const button = { disabled: false };
    const makeOption = (value = "", textContent = "") => ({
      value,
      textContent,
      cloneNode() {
        return makeOption(this.value, this.textContent);
      },
    });
    const elements = {};
    for (const id of [
      "session-id",
      "editor-trainer",
      "editor-location",
      "editor-date-time",
    ]) {
      const contents = html.match(
        new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`),
      )[1];
      const matches = [
        ...contents.matchAll(
          /<option value="([^"]*)"([^>]*)>([^<]*)<\/option>/g,
        ),
      ];
      elements[id] = {
        value:
          matches.find((match) => match[2].includes("selected"))?.[1] ?? "",
        options: matches.map((match) => makeOption(match[1], match[3])),
        listeners: {},
        addEventListener(event, handler) {
          this.listeners[event] = handler;
        },
        replaceChildren(...options) {
          this.options = options;
        },
        form: { querySelector: () => button },
      };
    }
    const metadata = html.match(
      /id="editor-session-data" hidden data-sessions="([^"]*)"/,
    )[1];
    elements["editor-session-data"] = {
      dataset: { sessions: metadata.replaceAll("&#34;", '"') },
    };
    elements["editor-session-status"] = { textContent: "" };
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(
      (match) => match[1].includes("const sessionSelect"),
    )[1];
    runInNewContext(script, {
      document: {
        getElementById: (id) => elements[id],
        createElement: () => makeOption(),
      },
    });
    const select = elements["session-id"];
    const ids = () =>
      select.options.map((option) => option.value).filter(Boolean);
    const change = (id, value) => {
      elements[id].value = value;
      elements[id].listeners.change();
    };
    expect(ids()).toEqual(["1"]);
    expect(select.value).toBe("1");
    expect(button.disabled).toBe(false);
    const label = (id) =>
      select.options.find((option) => option.value === id).textContent;
    expect(label("1")).toBe("Own session");
    change("editor-trainer", "");
    expect(ids()).toEqual(["1", "3"]);
    expect(select.value).toBe("1");
    expect(label("3")).toBe("Own session - Other Coach");
    change("editor-location", "");
    expect(ids()).toEqual(["1", "3", "4"]);
    expect(label("1")).toBe("Own session - Test Trainer - Main");
    expect(label("3")).toBe("Own session - Other Coach - Main");
    expect(label("4")).toBe("Own session - Test Trainer - West");
    change("editor-date-time", "");
    expect(ids()).toEqual(["1", "3", "4", "2"]);
    expect(label("4")).toBe(
      "Own session - 10/10/2026 9:00am - Test Trainer - West",
    );
    expect(label("2")).toBe(
      "Other session - 11/10/2026 10:00am - Other Coach - West",
    );
    change("editor-trainer", "8");
    expect(ids()).toEqual(["3", "2"]);
    expect(label("3")).toBe("Own session - 10/10/2026 9:00am - Main");
    expect(select.value).toBe("");
    expect(button.disabled).toBe(true);
    expect(elements["editor-session-status"].textContent).toContain(
      "Select a session",
    );
    change("session-id", "3");
    expect(button.disabled).toBe(false);
    change("editor-location", "2");
    expect(ids()).toEqual(["2"]);
    expect(label("2")).toBe("Other session - 11/10/2026 10:00am");
    change("editor-date-time", "2026-10-10 09:00");
    expect(ids()).toEqual([]);
    expect(select.options[0].textContent).toBe(
      "No sessions match these filters",
    );
    expect(button.disabled).toBe(true);
    expect(elements["editor-session-status"].textContent).toBe(
      "No sessions match these filters.",
    );
  });

  test.each(["", "/1"])(
    "orders session options by date then time when creating or editing at %s",
    async (path) => {
      const unsortedSessions = [
        sessions[1],
        sessions[0],
        { ...sessions[0], id: 3, title: "Earlier session", time: "08:00:00" },
      ];
      SessionsModel.getAll.mockResolvedValue(unsortedSessions);
      const html = await (
        await get(`${path}?sort_by=session_date&sort_dir=desc`)
      ).text();
      const select = html.match(
        /<select id="session-id"[^>]*>([\s\S]*?)<\/select>/,
      )[1];
      expect(
        [...select.matchAll(/<option value="(\d+)"/g)].map((match) => match[1]),
      ).toEqual(["3", "1", "2"]);
      if (path) {
        expect(select).toContain(
          '<option value="1" selected>Own session - 10/10/2026 9:00am</option>',
        );
      }
      expect(unsortedSessions.map((session) => session.id)).toEqual([2, 1, 3]);
    },
  );

  test("hides past sessions but keeps today's bookings created earlier", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dateValue = (date) =>
      [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
    SessionsModel.getAll.mockResolvedValue([
      { ...sessions[0], title: "Past session", date: dateValue(yesterday) },
      {
        ...sessions[1],
        title: "Today session",
        date: dateValue(today),
        time: "00:00:00",
      },
    ]);
    const html = await (await get()).text();
    const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
    expect(tbody).not.toContain("Past session");
    expect(tbody).toContain("Today session");
    expect(tbody).not.toContain("2026-10-02");
  });

  test.each(["", "/2"])(
    "session dropdown excludes yesterday and includes today and tomorrow at %s",
    async (path) => {
      const today = new Date();
      const dateValue = (offset) => {
        const date = new Date(today);
        date.setDate(date.getDate() + offset);
        return [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");
      };
      SessionsModel.getAll.mockResolvedValue([
        { ...sessions[0], title: "Yesterday session", date: dateValue(-1) },
        {
          ...sessions[1],
          title: "Today session",
          date: dateValue(0),
          time: "00:00:00",
        },
        {
          ...sessions[0],
          id: 3,
          title: "Tomorrow session",
          date: dateValue(1),
        },
      ]);
      const response = await get(path);
      expect(response.status).toBe(200);
      const html = await response.text();
      const select = html.match(
        /<select id="session-id"[^>]*>([\s\S]*?)<\/select>/,
      )[1];
      expect(select).not.toContain("Yesterday session");
      expect(
        [...select.matchAll(/<option value="(\d+)"/g)].map((match) => match[1]),
      ).toEqual(["2", "3"]);
      if (path) {
        expect(select).toContain(
          `<option value="2" selected>Today session - ${dateValue(0).split("-").reverse().join("/")} 12:00am</option>`,
        );
      }
    },
  );

  test.each([
    ["", [1, 2]],
    ["?trainer_id=7&location_id=2", []],
    ["?trainer_id=8&location_id=2&search_term=Sam", [2]],
  ])("filters booking rows with %s", async (query, expected) => {
    const html = await (await get(query)).text();
    const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
    const ids = [...tbody.matchAll(/href="\/manage\/bookings\/(\d+)\?/g)]
      .map((match) => Number(match[1]))
      .sort();
    expect(ids).toEqual(expected);
    expect(html.indexOf('id="booking-search"')).toBeLessThan(
      html.indexOf('id="trainer-filter"'),
    );
    expect(html.indexOf('id="trainer-filter"')).toBeLessThan(
      html.indexOf('id="location-filter"'),
    );
    if (!query) expect(html.match(/value="all" selected/g)).toHaveLength(2);
  });

  test("preserves filters in sort and edit links without widening trainer access", async () => {
    const html = await (await get("?trainer_id=7&location_id=1")).text();
    expect(html).toContain("trainer_id=7&amp;location_id=1");
    const trainerHtml = await (await get("?trainer_id=8", "trainer")).text();
    expect(trainerHtml).toContain("Own session");
    expect(trainerHtml).not.toContain("Other session");
    expect(
      trainerHtml.match(/<select id="trainer-filter"[\s\S]*?<\/select>/)[0],
    ).not.toContain("Coach, Other");
  });

  test.each(["admin", "trainer"])(
    "renders scoped list and editor for %s",
    async (role) => {
      const response = await get("", role);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Own session");
      const table = html.match(/<table[\s\S]*?<\/table>/)[0];
      expect(table).toContain(">Own session</a>");
      expect(table).not.toContain("Own session -");
      expect(table).toContain(">Session date/time</a>");
      expect(table).toContain("<td>10/10/2026 9:00am</td>");
      expect(table).not.toContain(">Created</a>");
      expect(table).not.toContain("<td>2026-10-01</td>");
      expect(html.includes("Other session")).toBe(role === "admin");
      expect(
        html.match(/<select id="user-id"[\s\S]*?<\/select>/)[0],
      ).not.toContain("Trainer, Test");
      expect(html.indexOf('id="booking-search"')).toBeLessThan(
        html.indexOf("<table"),
      );
      expect(html.indexOf("<table")).toBeLessThan(
        html.indexOf('id="booking-management"'),
      );
      expect(html).toContain('action="/manage/bookings"');
      const edit = await get("/1", role);
      expect(edit.status).toBe(200);
      expect(await edit.text()).toContain('action="/manage/bookings/1"');
    },
  );
  test("does not expose another trainer's booking in the editor", async () => {
    expect((await get("/2", "trainer")).status).toBe(404);
    expect((await get("/999")).status).toBe(404);
  });

  test("paginates seven rows and supports edit outside the current page", async () => {
    BookingsModel.getAll.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        id: index + 1,
        session_id: 1,
        user_id: 10,
        created: `2026-10-${String(index + 1).padStart(2, "0")}`,
      })),
    );
    const html = await (await get("/1?sort_by=session&sort_dir=asc")).text();
    const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
    expect(tbody.match(/<tr>/g)).toHaveLength(7);
    expect(html.indexOf('aria-label="Bookings pagination"')).toBeLessThan(
      html.indexOf('id="booking-management"'),
    );
    expect(html).toContain("Page 1 of 2");
    expect(await (await get("?page=2")).text()).toContain("Page 2 of 2");
  });

  test.each(["admin", "trainer"])(
    "creates, updates and deletes authorised bookings as %s",
    async (role) => {
      const create = jest
        .spyOn(BookingsModel, "create")
        .mockResolvedValue({ affectedRows: 1 });
      const update = jest
        .spyOn(BookingsModel, "update")
        .mockResolvedValue({ affectedRows: 1 });
      const deletion = jest
        .spyOn(BookingsModel, "delete")
        .mockResolvedValue({ affectedRows: 1 });
      for (const action of ["create", "update", "delete"]) {
        const result = await post(
          action,
          action === "create" ? "" : "/1",
          role,
        );
        expect(result.status).toBe(302);
        expect(result.headers.get("location")).toBe("/manage/bookings");
      }
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ session_id: 1, user_id: 11 }),
      );
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
      expect(deletion).toHaveBeenCalledWith(1);
    },
  );
  test.each(["create", "update"])(
    "rejects overlapping member bookings during staff %s",
    async (action) => {
      jest
        .spyOn(BookingsModel, action)
        .mockResolvedValue({ affectedRows: 0, overlap: true });
      const response = await post(action, action === "update" ? "/1" : "");
      expect(response.status).toBe(409);
      expect(await response.text()).toContain(
        "This member already has a booking at this date and time.",
      );
      expect(response.headers.get("location")).toBeNull();
    },
  );
  test.each(["create", "update", "delete"])(
    "blocks unauthorised trainer %s",
    async (action) => {
      const write = jest.spyOn(BookingsModel, action);
      const result = await post(
        action,
        action === "create" ? "" : "/2",
        "trainer",
        { sessionId: "2", userId: "10" },
      );
      expect(result.status).toBe(403);
      expect(write).not.toHaveBeenCalled();
    },
  );
  test("blocks moving an owned booking into another trainer's session", async () => {
    const update = jest.spyOn(BookingsModel, "update");
    expect(
      (await post("update", "/1", "trainer", { sessionId: "2", userId: "10" }))
        .status,
    ).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  test.each([
    [{ sessionId: "99", userId: "10" }, 400],
    [{ sessionId: "1", userId: "99" }, 400],
    [{ sessionId: "1", userId: "7" }, 400],
    [{ sessionId: "1", userId: "10" }, 409],
  ])("rejects invalid or duplicate destination %j", async (fields, code) => {
    const create = jest.spyOn(BookingsModel, "create");
    expect((await post("create", "", "admin", fields)).status).toBe(code);
    expect(create).not.toHaveBeenCalled();
  });
  test("allows an unchanged booking but rejects moving to a duplicate", async () => {
    jest.spyOn(BookingsModel, "update").mockResolvedValue({ affectedRows: 1 });
    expect(
      (await post("update", "/1", "admin", { sessionId: "1", userId: "10" }))
        .status,
    ).toBe(302);
    expect(
      (await post("update", "/1", "admin", { sessionId: "2", userId: "11" }))
        .status,
    ).toBe(409);
  });

  test.each(["create", "update", "delete"])(
    "reports missing rows and database failures for %s",
    async (action) => {
      const write = jest
        .spyOn(BookingsModel, action)
        .mockResolvedValue({ affectedRows: 0 });
      const path = action === "create" ? "" : "/1";
      expect((await post(action, path)).status).toBe(404);
      write.mockRejectedValue(new Error("database failed"));
      expect((await post(action, path)).status).toBe(500);
      expect(console.error).toHaveBeenCalled();
    },
  );

  test("keeps invalid form feedback on the staff management route", async () => {
    const result = await post("create", "", "trainer", {
      sessionId: "bad",
      userId: "",
    });
    expect(result.status).toBe(303);
    expect(result.headers.get("location")).toBe(
      "/manage/bookings#form-validation",
    );
    expect(BookingsModel.getAll).not.toHaveBeenCalled();
  });
});
