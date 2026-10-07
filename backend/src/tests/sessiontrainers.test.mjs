import ejs from "ejs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "@jest/globals";

const users = [
  { id: 3, role: "trainer", first_name: "Own", last_name: "Trainer" },
  { id: 4, role: "trainer", first_name: "Other", last_name: "Trainer" },
  { id: 5, role: "member", first_name: "Test", last_name: "Member" },
];

const renderTrainerSelect = async (role, editing, feedback) => {
  const html = await ejs.renderFile(
    fileURLToPath(new URL("../views/session_management.ejs", import.meta.url)),
    {
      authenticatedUser: { ...users[0], id: "3", role },
      role,
      users,
      sessions: [],
      activities: [],
      locations: [],
      selectedSession: {
        id: editing ? 1 : null,
        trainer_id: editing ? 3 : 0,
        title: editing ? "Test session" : "",
      },
      selectedSessionHasBookings: false,
      selectedLocationId: null,
      selectedTrainerId: role === "trainer" ? 3 : null,
      selectedSearchTerm: "",
      selectedSortBy: "date",
      selectedSortDir: "asc",
      selectedPage: 1,
      totalPages: 1,
      hasFormFeedback: feedback,
      formDestination: editing ? "/sessions/1" : "/sessions",
      formErrors: feedback ? { title: "Title is required." } : {},
      formValues: feedback ? { trainerId: "3", title: "" } : {},
    },
  );
  expect(html.indexOf('id="session-search"')).toBeLessThan(
    html.indexOf('id="location-filter"'),
  );
  expect(html.indexOf('id="session-search"')).toBeLessThan(
    html.indexOf('id="trainer-filter"'),
  );
  return html.match(/<select id="trainer-id"[^>]*>([\s\S]*?)<\/select>/)[1];
};

describe.each([false, true])(
  "session trainer dropdown (editing: %s)",
  (editing) => {
    test.each([false, true])(
      "shows only the authenticated trainer, including after validation feedback: %s",
      async (feedback) => {
        const select = await renderTrainerSelect("trainer", editing, feedback);

        expect(select.match(/<option\b/g)).toHaveLength(1);
        expect(select).toMatch(
          /<option value="3" selected>Trainer, Own<\/option>/,
        );
        expect(select).not.toContain("Trainer, Other");
        expect(select).not.toContain("Member, Test");
      },
    );

    test("keeps all trainers available for admins", async () => {
      const select = await renderTrainerSelect("admin", editing, false);

      expect(select).toContain("Trainer, Own");
      expect(select).toContain("Trainer, Other");
      expect(select).not.toContain("Member, Test");
      if (editing) {
        expect(select).toMatch(
          /<option value="3" selected>Trainer, Own<\/option>/,
        );
      } else {
        expect(select).toContain("Select an option");
      }
    });
  },
);
