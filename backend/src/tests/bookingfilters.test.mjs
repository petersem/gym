import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "@jest/globals";

const template = readFileSync(
  new URL("../views/booking_management.ejs", import.meta.url),
  "utf8",
);
const script = template.match(/<script>([\s\S]*?)<\/script>/)[1];
const filters = [
  "available_location_id",
  "available_trainer_id",
  "booking_location_id",
  "booking_trainer_id",
];

describe("booking dropdown navigation", () => {
  test("wires every dropdown to the shared filter handler", () => {
    expect(
      [...template.matchAll(/onchange="filterBookings\('([^']+)'/g)].map(
        ([, key]) => key,
      ),
    ).toEqual(filters);
  });

  describe.each(filters)("%s", (key) => {
    test.each(["7", "all", ""])(
      "clears result flags and preserves other filters when selecting %p",
      (value) => {
        const params = new URLSearchParams({
          available_location_id: "1",
          available_trainer_id: "6",
          booking_location_id: "2",
          booking_trainer_id: "3",
          booking_user_id: "4",
          session_id: "5",
          booking_created: "1",
          booking_deleted: "1",
        });
        const window = {
          location: { search: `?${params}`, hash: "", href: "" },
        };
        const context = {
          window,
          document: { querySelectorAll: () => [] },
          URLSearchParams,
        };
        runInNewContext(script, context);
        context.filterBookings(key, value);

        const url = new URL(window.location.href, "http://localhost");
        expect(url.pathname).toBe(
          key.startsWith("booking_") ? "/bookings" : "/timetable",
        );
        expect(url.searchParams.has("booking_created")).toBe(false);
        expect(url.searchParams.has("booking_deleted")).toBe(false);
        expect(url.searchParams.has("booking_user_id")).toBe(false);
        expect(url.searchParams.has("session_id")).toBe(false);
        expect(url.searchParams.get(key)).toBe(value || null);
        for (const otherKey of filters.filter((filter) => filter !== key)) {
          expect(url.searchParams.get(otherKey)).toBe(params.get(otherKey));
        }
        expect(url.hash).toBe(
          key.startsWith("booking_") ? "#bookings-next-7-days" : "",
        );
      },
    );
  });
});
