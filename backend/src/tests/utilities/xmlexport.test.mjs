import { describe, expect, test } from "@jest/globals";
import {
  bookingsDtd,
  bookingsXmlContent,
  bookingXmlRecord,
  buildXmlDocument,
  sessionsDtd,
  sessionsXmlContent,
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

  test("includes session IDs in session exports but omits them from booking exports", () => {
    expect(sessionXmlRecord(session, lookups)).toHaveProperty("id", "1");
    expect(
      bookingXmlRecord({ id: 2 }, session, lookups).session,
    ).not.toHaveProperty("id");
  });

  test("declares booking and member XML elements consistently", () => {
    expect(bookingsDtd).toContain("<!ELEMENT id (#PCDATA)>");
    expect(bookingsDtd).toContain(
      "<!ELEMENT booking (id, member, created, session)>",
    );
    expect(bookingsDtd).toContain("<!ELEMENT member (firstName, lastName)>");
    expect(
      bookingXmlRecord({ id: 1, user_id: 9 }, session, {
        ...lookups,
        users: [{ id: 9, first_name: "A", last_name: "Member" }],
      }),
    ).toHaveProperty("member", { firstName: "A", lastName: "Member" });
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

  test("places the export date on the gymBookings root element", () => {
    const today = new Date();
    const expectedDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const xml = buildXmlDocument(
      "gymBookings",
      bookingsXmlContent([{ id: "1" }]),
      "<!DOCTYPE gymBookings []>",
    );

    expect(xml).toContain(`<gymBookings export-date="${expectedDate}">`);
    expect(xml).not.toContain('<booking export-date="');
  });

  test("places the export date on the gymSessions root element", () => {
    const today = new Date();
    const expectedDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const xml = buildXmlDocument(
      "gymSessions",
      sessionsXmlContent([{ id: "1" }]),
      sessionsDtd,
    );

    expect(xml).toContain(`<gymSessions export-date="${expectedDate}">`);
    expect(xml).not.toContain('<session export-date="');
    expect(sessionsDtd).toContain(
      '<!ATTLIST gymSessions export-date CDATA "0000-00-00">',
    );
  });
});
