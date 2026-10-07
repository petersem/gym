import ejs from "ejs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

const pages = [
  ["login", ["username", "password"]],
  ["register", ["first-name", "last-name", "email", "password", "phone"]],
  ["activity_management", ["name", "description"]],
  [
    "location_management",
    ["name", "phone", "email", "street", "suburb", "postcode", "manager"],
  ],
  [
    "user_management",
    ["first-name", "last-name", "role", "email", "password", "phone"],
  ],
  ["blog_management", ["title", "content"]],
  [
    "session_management",
    ["title", "activity-id", "location-id", "trainer-id", "date", "time-hour"],
  ],
  ["booking_management", ["booking-session-id", "booking-user-id"]],
];

const localsFor = (editing) => {
  const selected = {
    id: editing ? 1 : null,
    created: "2026-10-04",
    user_id: 1,
  };
  return {
    authenticatedUser: {
      id: 1,
      role: "admin",
      first_name: "Test",
      last_name: "Admin",
    },
    role: "admin",
    activities: [],
    locations: [],
    users: [],
    blogs: [],
    sessions: [],
    bookings: [],
    calendarDays: [],
    bookingCalendarDays: [],
    selectedActivity: selected,
    selectedLocation: selected,
    selectedUser: selected,
    selectedBlog: selected,
    selectedSession: selected,
    selectedBooking: selected,
    selectedSessionHasBookings: false,
    selectedSearchTerm: "",
    selectedRole: "",
    selectedSortBy: "name",
    selectedSortDir: "asc",
    selectedPage: 1,
    totalPages: 1,
    selectedLocationId: null,
    selectedTrainerId: null,
    availableLocationId: null,
    availableTrainerId: null,
    bookingLocationId: null,
    bookingTrainerId: null,
    bookingUserId: null,
    canManageBookings: true,
    bookingDeleted: false,
    bookingCreated: false,
    showAvailableSessions: true,
    showBookings: true,
    pageTitle: "Bookings",
    hasFormFeedback: true,
    formDestination: "/retry",
    formAction: editing ? "update" : "create",
    formErrors: {},
    formValues: {},
  };
};

test("timetable marks only the current member's booked sessions and disables booking them", async () => {
  const locals = localsFor(false);
  locals.authenticatedUser.role = "member";
  locals.bookings = [
    { id: 1, user_id: "1", session_id: "10" },
    { id: 2, user_id: 2, session_id: 11 },
  ];
  locals.calendarDays = [{
    label: "Today",
    sessions: [
      { id: 10, title: "Already booked", time: "09:00:00" },
      { id: 11, title: "Available session", time: "10:00:00" },
    ],
  }];
  const template = fileURLToPath(new URL("../views/booking_management.ejs", import.meta.url));
  const html = await ejs.renderFile(template, locals);
  const items = [...html.matchAll(/<li class="available-session">([\s\S]*?)<\/li>/g)]
    .map((match) => match[1]);
  expect(items).toHaveLength(2);
  expect(items[0]).toContain('class="session-booked-label">BOOKED</span>');
  expect(items[0]).toMatch(/class="available-session-select"\s+disabled/);
  expect(items[0]).toMatch(/value="create"\s+disabled/);
  expect(items[1]).not.toContain("BOOKED");
  expect(items[1]).not.toMatch(/\sdisabled(?:\s|>)/);
  const guestHtml = await ejs.renderFile(template, { ...locals, authenticatedUser: undefined });
  expect(guestHtml).not.toContain('class="session-booked-label"');
  expect(guestHtml).not.toContain('class="available-session-select"');
});

test.each([
  ["location_management", ["manager"]],
  ["session_management", ["trainer-filter", "trainer-id"]],
  ["booking_management", ["booking-user-id", "available-trainer-filter", "booking-trainer-filter"]],
])("%s sorts every user dropdown by displayed name", async (page, ids) => {
  const locals = localsFor(true);
  locals.users = [
    { id: 2, role: "trainer", first_name: "Alex", last_name: "Zulu" },
    { id: 3, role: "trainer", first_name: "Zoe", last_name: "Alpha" },
    { id: 1, role: "trainer", first_name: "Ben", last_name: "Alpha" },
  ];
  if (page === "booking_management") locals.authenticatedUser.role = "member";
  const html = await ejs.renderFile(
    fileURLToPath(new URL(`../views/${page}.ejs`, import.meta.url)),
    locals,
  );
  for (const id of ids) {
    const select = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))[1];
    const values = [...select.matchAll(/<option value="([123])"/g)].map((match) => match[1]);
    expect(values).toEqual(["1", "3", "2"]);
  }
});

test.each(["/blogs", "/manage/blogs"])(
  "omits the creation timestamp from the blog editor at %s",
  async (blogPath) => {
    const html = await ejs.renderFile(
      fileURLToPath(new URL("../views/partials/blog-form.ejs", import.meta.url)),
      {
        ...localsFor(true),
        blogPath,
        canManageBlog: () => true,
      },
    );
    expect(html).not.toContain("Created:");
    expect(html).not.toContain("2026-10-04");
    expect(html).toContain("Author");
    expect(html).toContain("Update post");
  },
);

describe.each([false, true])(
  "required field labels (editing: %s)",
  (editing) => {
    test.each(pages)("%s marks only its required fields", async (page, ids) => {
      const locals = localsFor(editing);
      if (page === "booking_management")
        locals.authenticatedUser.role = "member";
      const html = await ejs.renderFile(
        fileURLToPath(new URL(`../views/${page}.ejs`, import.meta.url)),
        locals,
      );
      const markedLabels = [
        ...html.matchAll(/<label\b([^>]*)>([^<]*)<\/label>/g),
      ]
        .filter(([, , label]) => label.trim().endsWith("*"))
        .map(([, attributes]) => attributes.match(/\bfor="([^"]+)"/)?.[1]);

      expect(markedLabels).toEqual(ids);
      if (page === "user_management") {
        expect(html).toContain('placeholder="e.g. alex@example.com"');
        expect(html).toContain('placeholder="e.g. 0412 345 678"');
      }
      expect(html).toContain('<p class="two-col">* Required fields</p>');
      expect(html).not.toMatch(
        /<(?:input|select|textarea)\b[^>]*\srequired(?:\s|=|>)/,
      );
    });
  },
);
