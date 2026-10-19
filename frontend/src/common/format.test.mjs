import { describe, expect, test } from "@jest/globals";
import { formatDate, formatRelativeDate } from "./format.mjs";

describe("formatRelativeDate", () => {
  test("labels today using the local calendar date", () => {
    const now = new Date(2026, 9, 19, 23, 30);
    expect(formatRelativeDate("2026-10-19", now)).toBe("Today");
    expect(formatRelativeDate("2026-10-19T00:00:00.000Z", now)).toBe("Today");
  });

  test("labels tomorrow across month and year boundaries", () => {
    expect(
      formatRelativeDate("2026-11-01", new Date(2026, 9, 31, 23, 30)),
    ).toBe("Tomorrow");
    expect(
      formatRelativeDate("2027-01-01", new Date(2026, 11, 31, 23, 30)),
    ).toBe("Tomorrow");
  });

  test("uses the formatted date for later days", () => {
    expect(formatRelativeDate("2026-10-21", new Date(2026, 9, 19))).toBe(
      formatDate("2026-10-21"),
    );
  });

  test("returns an empty label for an absent date", () => {
    expect(formatRelativeDate(null)).toBe("");
  });

  test("does not mutate the supplied reference date", () => {
    const now = new Date(2026, 9, 19, 23, 30);
    const timestamp = now.getTime();
    formatRelativeDate("2026-10-20", now);
    expect(now.getTime()).toBe(timestamp);
  });
});
