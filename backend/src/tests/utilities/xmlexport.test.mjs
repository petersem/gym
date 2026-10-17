import { describe, expect, test } from "@jest/globals";
import {
  bookingXmlRecord,
  sessionXmlRecord,
} from "../../utilities/xmlExport.mjs";

const lookups = { activities: [], locations: [], users: [] };
const session = { id: 1, date: "2026-10-16", time: "13:05:00" };

describe("XML local date/time formatting", () => {
  test.each([
    ["00:00:00", "12:00am"],
    ["09:05:00", "9:05am"],
    ["12:00:00", "12:00pm"],
    ["23:59:00", "11:59pm"],
  ])("formats session time %s as %s", (time, expected) => {
    expect(sessionXmlRecord({ ...session, time }, lookups)).toMatchObject({
      date: "16/10/2026",
      time: expected,
    });
  });

  test("formats Date session values using their local calendar date", () => {
    expect(
      sessionXmlRecord({ ...session, date: new Date(2026, 9, 16) }, lookups)
        .date,
    ).toBe("16/10/2026");
  });

  test.each([
    "2026-10-16 00:05:00",
    new Date(2026, 9, 16, 0, 5),
    new Date(2026, 9, 16, 0, 5).toISOString(),
  ])("formats booking creation in local time: %s", (created) => {
    expect(bookingXmlRecord({ id: 1, created }, session, lookups).created).toBe(
      "16/10/2026, 12:05am",
    );
  });

  test("keeps missing booking timestamps empty", () => {
    expect(bookingXmlRecord({ id: 1 }, session, lookups).created).toBe("");
  });

  test("reports invalid timestamps rather than exporting them", () => {
    expect(() =>
      bookingXmlRecord({ id: 1, created: "invalid" }, session, lookups),
    ).toThrow(RangeError);
  });
});
