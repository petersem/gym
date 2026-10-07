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
      expect(html).toContain('<p class="two-col">* Required fields</p>');
      expect(html).not.toMatch(
        /<(?:input|select|textarea)\b[^>]*\srequired(?:\s|=|>)/,
      );
    });
  },
);
