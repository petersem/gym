import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { BookingsController } from "../../controllers/BookingsController.mjs";
import { BookingsModel } from "../../models/BookingsModel.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";
import { SessionsModel } from "../../models/SessionsModel.mjs";
import { LocationModel } from "../../models/LocationModel.mjs";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import ejs from "ejs";
import { fileURLToPath } from "node:url";

const response = () => {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
    render: jest.fn(),
    redirect: jest.fn(),
    send: jest.fn(),
    set: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.set.mockReturnValue(res);
  return res;
};

const request = (
  params = {},
  query = {},
  body = {},
  authenticatedUser,
  baseUrl,
) => ({
  params,
  query,
  body,
  authenticatedUser,
  baseUrl,
});
const next = () => jest.fn();

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Model spies keep booking permissions, filters, and redirects database-independent.
describe("BookingsController", () => {
  test("requires authentication to export bookings XML", async () => {
    const getAll = jest.spyOn(BookingsModel, "getAll");
    const res = response();

    await BookingsController.exportBookingsXml(request(), res, next());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith("Authentication required.");
    expect(getAll).not.toHaveBeenCalled();
  });

  test("exports a member's upcoming bookings as well-formed XML", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateValue = (date) =>
      [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
    const todayValue = dateValue(today);
    const afterSevenDays = new Date(today);
    afterSevenDays.setDate(afterSevenDays.getDate() + 7);
    const tooLateValue = dateValue(afterSevenDays);
    const bookings = [
      { id: 101, session_id: 11, user_id: 7 },
      { id: 102, session_id: 12, user_id: 7 },
      { id: 103, session_id: 99, user_id: 7 },
    ];
    const getByUserId = jest
      .spyOn(BookingsModel, "getByUserId")
      .mockResolvedValue(bookings);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue([
      {
        id: 11,
        title: "Spin & Strength",
        activity_id: 3,
        location_id: 9,
        trainer_id: 12,
        date: todayValue,
        time: "10:30:00",
      },
      {
        id: 12,
        title: "Next week",
        activity_id: 3,
        location_id: 9,
        trainer_id: 12,
        date: tooLateValue,
        time: "11:00:00",
      },
    ]);
    jest.spyOn(LocationModel, "getAll").mockResolvedValue([
      {
        id: 9,
        name: "Central Gym",
        street: "1 Main Street",
        suburb: "Brisbane",
        postcode: 4000,
      },
    ]);
    jest
      .spyOn(ActivitiesModel, "getAll")
      .mockResolvedValue([
        { id: 3, name: "Strength", description: "Build strength & mobility." },
      ]);
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([
      { id: "7", first_name: "Alex & Sam", last_name: "O'Brien" },
      { id: 12, first_name: "Taylor", last_name: "Trainer" },
    ]);
    const res = response();

    await BookingsController.exportBookingsXml(
      request({}, { booking_location_id: "9" }, {}, { id: 7, role: "member" }),
      res,
      next(),
    );

    expect(getByUserId).toHaveBeenCalledWith(7);
    expect(res.set).toHaveBeenCalledWith({
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gym-bookings.xml"',
    });
    expect(res.send.mock.calls[0][0]).toContain(
      '<?xml version="1.0" encoding="UTF-8"?>',
    );
    expect(res.send.mock.calls[0][0]).toContain("<!DOCTYPE gymBookings [");
    expect(res.send.mock.calls[0][0]).toContain(
      "<!ELEMENT booking (id, userId, user, created, session)>",
    );
    expect(res.send.mock.calls[0][0]).toContain(
      "<!ELEMENT user (firstName, lastName)>",
    );
    expect(res.send.mock.calls[0][0]).toMatch(
      /<user>\s*<firstName>Alex &amp; Sam<\/firstName>\s*<lastName>O&apos;Brien<\/lastName>\s*<\/user>/,
    );
    expect(res.send.mock.calls[0][0]).toMatch(
      /<trainer>\s*<firstName>Taylor<\/firstName>\s*<lastName>Trainer<\/lastName>\s*<\/trainer>/,
    );
    expect(res.send.mock.calls[0][0]).toContain("<gymBookings>");
    expect(res.send.mock.calls[0][0]).toContain(
      "<title>Spin &amp; Strength</title>",
    );
    expect(res.send.mock.calls[0][0]).toContain(`<date>${todayValue}</date>`);
    expect(res.send.mock.calls[0][0]).toContain("<time>10:30:00</time>");
    expect(res.send.mock.calls[0][0]).toContain("<name>Central Gym</name>");
    expect(res.send.mock.calls[0][0]).toContain(
      "<street>1 Main Street</street>",
    );
    expect(res.send.mock.calls[0][0]).not.toContain("Next week");
  });

  test("renders booking management and handles load errors", async () => {
    const bookings = [{ id: 1, session_id: 4, user_id: 7 }];
    const authenticatedUser = { id: 7, role: "member" };
    const sessions = [
      {
        id: 4,
        location_id: 9,
        activity_id: 3,
        trainer_id: 12,
        date: new Date().toISOString().slice(0, 10),
        time: "10:00:00",
      },
    ];
    const activities = [{ id: 3, name: "Yoga" }];
    const getByUserId = jest
      .spyOn(BookingsModel, "getByUserId")
      .mockResolvedValue(bookings);
    jest
      .spyOn(UsersModel, "getAll")
      .mockResolvedValue([
        { id: 12, first_name: "Taylor", last_name: "Trainer" },
      ]);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue(sessions);
    jest
      .spyOn(LocationModel, "getAll")
      .mockResolvedValue([{ id: 9, name: "Central Gym" }]);
    jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue(activities);
    const res = response();

    await BookingsController.viewBookingManagement(
      request({ id: "1" }, {}, {}, authenticatedUser),
      res,
    );
    expect(getByUserId).toHaveBeenCalledWith(7);
    expect(res.render).toHaveBeenCalledWith(
      "booking_management.ejs",
      expect.objectContaining({ bookings, activities }),
    );
    expect(res.render).toHaveBeenCalledWith(
      "booking_management.ejs",
      expect.objectContaining({
        bookingUserId: 7,
        canManageBookings: false,
      }),
    );

    await BookingsController.viewBookingManagement(
      request({ id: "999" }, {}, {}, authenticatedUser),
      res,
    );
    expect(res.render).toHaveBeenCalledWith(
      "booking_management.ejs",
      expect.objectContaining({
        selectedBooking: expect.objectContaining({ id: null }),
      }),
    );

    await BookingsController.viewBookingManagement(
      request(
        { id: "1" },
        { available_location_id: "9" },
        {},
        authenticatedUser,
      ),
      res,
    );
    await BookingsController.viewBookingManagement(
      request({ id: "1" }, { booking_location_id: "9" }, {}, authenticatedUser),
      res,
    );
    await BookingsController.viewBookingManagement(
      request({}, { session_id: "4" }, {}, authenticatedUser),
      res,
    );
    expect(res.render).toHaveBeenCalledWith(
      "booking_management.ejs",
      expect.objectContaining({
        selectedBooking: expect.objectContaining({ session_id: "4" }),
      }),
    );

    await BookingsController.viewBookingManagement(
      request({}, { booking_deleted: "1" }, {}, authenticatedUser),
      res,
    );
    expect(res.render).toHaveBeenCalledWith(
      "booking_management.ejs",
      expect.objectContaining({ bookingDeleted: true }),
    );

    getByUserId.mockRejectedValue(new Error("database error"));
    await BookingsController.viewBookingManagement(
      request({}, {}, {}, authenticatedUser),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test.each(["admin", "trainer"])(
    "%s only sees their own bookings",
    async (role) => {
      const bookings = [
        { id: 1, session_id: 4, user_id: 7 },
        { id: 2, session_id: 4, user_id: 8 },
      ];
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const sessionDate = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");
      const getAll = jest.spyOn(BookingsModel, "getAll");
      const getByUserId = jest
        .spyOn(BookingsModel, "getByUserId")
        .mockResolvedValue([bookings[0]]);
      jest.spyOn(UsersModel, "getAll").mockResolvedValue([
        { id: 1, first_name: "Taylor", last_name: "Trainer", role: "trainer" },
        { id: 7, first_name: "Alex", last_name: "Member" },
        { id: 8, first_name: "Sam", last_name: "Member" },
      ]);
      jest.spyOn(SessionsModel, "getAll").mockResolvedValue([
        {
          id: 4,
          location_id: 9,
          trainer_id: 1,
          date: sessionDate,
          time: "10:00:00",
        },
      ]);
      jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
      jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
      const res = response();
      const authenticatedUser = { id: 7, role };

      await BookingsController.viewBookingManagement(
        request({}, {}, {}, authenticatedUser),
        res,
      );
      expect(getAll).not.toHaveBeenCalled();
      expect(getByUserId).toHaveBeenCalledWith(7);

      const defaultExpectations = {
        canManageBookings: true,
        bookingUserId: authenticatedUser.id,
        bookingTrainerId: null,
      };
      expect(res.render).toHaveBeenCalledWith(
        "booking_management.ejs",
        expect.objectContaining(defaultExpectations),
      );
      expect(
        res.render.mock.calls.at(-1)[1].bookingCalendarDays[0].bookings,
      ).toEqual([bookings[0]]);

      await BookingsController.viewBookingManagement(
        request({}, { booking_user_id: "8" }, {}, authenticatedUser),
        res,
      );
      const selectedUserData = res.render.mock.calls.at(-1)[1];
      expect(selectedUserData.bookingUserId).toBe(7);
      expect(selectedUserData.bookingCalendarDays[0].bookings).toEqual([
        bookings[0],
      ]);

      await BookingsController.viewBookingManagement(
        request({}, { booking_trainer_id: "all" }, {}, authenticatedUser),
        res,
      );
      const allTrainerData = res.render.mock.calls.at(-1)[1];
      expect(allTrainerData.bookingUserId).toBe(7);
      expect(allTrainerData.bookingCalendarDays[0].bookings).toEqual([
        bookings[0],
      ]);

      if (role === "trainer") {
        const trainerUsers = [
          {
            id: 12,
            first_name: "Taylor",
            last_name: "Trainer",
            role: "trainer",
          },
          { id: 13, first_name: "Jamie", last_name: "Coach", role: "trainer" },
        ];
        jest.spyOn(UsersModel, "getAll").mockResolvedValue(trainerUsers);
        jest.spyOn(SessionsModel, "getAll").mockResolvedValue([
          {
            id: 4,
            location_id: 9,
            trainer_id: 12,
            date: sessionDate,
            time: "10:00:00",
          },
          {
            id: 5,
            location_id: 9,
            trainer_id: 13,
            date: sessionDate,
            time: "11:00:00",
          },
        ]);
        await BookingsController.viewBookingManagement(
          request({}, { booking_trainer_id: "13" }, {}, authenticatedUser),
          res,
        );
        const selectedTrainerData = res.render.mock.calls.at(-1)[1];
        expect(selectedTrainerData.bookingTrainerId).toBe(13);
        expect(selectedTrainerData.bookingCalendarDays[0].sessions).toEqual([
          {
            id: 4,
            location_id: 9,
            trainer_id: 12,
            date: sessionDate,
            time: "10:00:00",
          },
          {
            id: 5,
            location_id: 9,
            trainer_id: 13,
            date: sessionDate,
            time: "11:00:00",
          },
        ]);
      }

      await BookingsController.viewBookingManagement(
        request({ id: "2" }, {}, {}, authenticatedUser),
        res,
      );
      expect(res.render.mock.calls.at(-1)[1].selectedBooking.id).toBeNull();
    },
  );

  test("groups sessions by their local calendar date", async () => {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const sessionDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");
    const session = {
      id: 22,
      location_id: 1,
      date: sessionDate,
      time: "10:00:00",
    };
    jest.spyOn(BookingsModel, "getAll").mockResolvedValue([]);
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue([session]);
    jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
    const res = response();

    await BookingsController.viewBookingManagement(request(), res);

    const { calendarDays } = res.render.mock.calls[0][1];
    expect(calendarDays[1].dateValue).toBe(sessionDate);
    expect(calendarDays[1].sessions).toEqual([session]);
  });

  test.each([
    [{}, [1, 2, 3], null],
    [{ available_location_id: "1", available_trainer_id: "12" }, [1], 12],
    [{ available_trainer_id: "99" }, [], 99],
  ])(
    "filters timetable sessions with %j",
    async (query, expectedIds, trainerId) => {
      const today = new Date();
      const date = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
      jest.spyOn(BookingsModel, "getByUserId").mockResolvedValue([]);
      jest.spyOn(UsersModel, "getAll").mockResolvedValue([
        { id: 12, role: "trainer", first_name: "Alex", last_name: "Trainer" },
        { id: 13, role: "trainer", first_name: "Sam", last_name: "Trainer" },
        { id: 7, role: "member", first_name: "Member", last_name: "Only" },
      ]);
      jest.spyOn(SessionsModel, "getAll").mockResolvedValue([
        {
          id: 1,
          trainer_id: "12",
          location_id: 1,
          date,
          time: "09:00:00",
          title: "First",
        },
        {
          id: 2,
          trainer_id: 13,
          location_id: 1,
          date,
          time: "10:00:00",
          title: "Second",
        },
        {
          id: 3,
          trainer_id: 12,
          location_id: 2,
          date,
          time: "11:00:00",
          title: "Third",
        },
      ]);
      jest
        .spyOn(LocationModel, "getAll")
        .mockResolvedValue([{ id: 1, name: "Main" }]);
      jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
      const res = response();
      await BookingsController.viewTimetable(
        request({}, query, {}, { id: 7, role: "member" }),
        res,
      );
      const locals = res.render.mock.calls[0][1];
      expect(locals.availableTrainerId).toBe(trainerId);
      expect(locals.sessions.map((session) => session.id)).toEqual(expectedIds);
      expect(
        locals.calendarDays[0].sessions.map((session) => session.id),
      ).toEqual(expectedIds);
      const html = await ejs.renderFile(
        fileURLToPath(
          new URL("../../views/booking_management.ejs", import.meta.url),
        ),
        locals,
      );
      expect(html.indexOf('id="available-location-filter"')).toBeLessThan(
        html.indexOf('id="available-trainer-filter"'),
      );
      const trainerSelect = html.match(
        /<select id="available-trainer-filter"[\s\S]*?<\/select>/,
      )[0];
      expect(trainerSelect).not.toContain("Member");
      expect(trainerSelect).toContain("Trainer, Alex");
      if (!trainerId)
        expect(trainerSelect).toMatch(/value="all"\s+selected\s*>All/);
      if (trainerId === 12)
        expect(trainerSelect).toMatch(/value="12"\s+selected/);
      const template = fileURLToPath(
        new URL("../../views/booking_management.ejs", import.meta.url),
      );
      const guestHtml = await ejs.renderFile(template, {
        ...locals,
        authenticatedUser: undefined,
      });
      expect(html).toContain("Click a session to book");
      expect(guestHtml).not.toContain("Click a session to book");
      for (const renderedHtml of [html, guestHtml]) {
        if (!trainerId) {
          expect(renderedHtml).toContain(
            query.available_location_id
              ? "Alex Trainer</span>"
              : "Main, Alex Trainer</span>",
          );
        } else {
          expect(renderedHtml).not.toContain("Main, Alex Trainer</span>");
          expect(renderedHtml).not.toContain("Alex Trainer</span>");
          if (expectedIds.length && !query.available_location_id) {
            expect(renderedHtml).toContain(
              'class="session-details">Main</span>',
            );
          }
        }
      }
      if (query.available_location_id && trainerId === 12) {
        expect(html).toContain(
          'action="/timetable?available_location_id=1&amp;available_trainer_id=12"',
        );
      }
    },
  );

  test("handles booking management actions and failures", async () => {
    const res = response();
    jest.spyOn(BookingsModel, "create").mockResolvedValue({});
    jest.spyOn(BookingsModel, "update").mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(BookingsModel, "delete").mockResolvedValue({ affectedRows: 1 });

    await BookingsController.handleBookingManagement(
      request({}, {}, { action: "create" }),
      res,
    );
    await BookingsController.handleBookingManagement(
      request(
        {},
        { available_location_id: "9" },
        { action: "create" },
        { id: 7, role: "member" },
        "/timetable",
      ),
      res,
    );
    expect(res.redirect).toHaveBeenLastCalledWith(
      "/timetable?available_location_id=9&booking_created=1",
    );
    await BookingsController.handleBookingManagement(
      request({ id: "2" }, {}, { action: "update" }),
      res,
    );
    await BookingsController.handleBookingManagement(
      request({ id: "2" }, {}, { action: "delete" }),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith("/bookings?booking_deleted=1");

    await BookingsController.handleBookingManagement(
      request({ id: "2" }, { booking_user_id: "8" }, { action: "delete" }),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith("/bookings?booking_deleted=1");

    BookingsModel.update.mockResolvedValue({ affectedRows: 0 });
    await BookingsController.handleBookingManagement(
      request({ id: "2" }, {}, { action: "update" }),
      res,
    );
    BookingsModel.delete.mockResolvedValue({ affectedRows: 0 });
    await BookingsController.handleBookingManagement(
      request({ id: "2" }, {}, { action: "delete" }),
      res,
    );
    await BookingsController.handleBookingManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).toHaveBeenCalledWith(400);

    BookingsModel.create.mockRejectedValue(new Error("database error"));
    await BookingsController.handleBookingManagement(
      request({}, {}, { action: "create" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);

    BookingsModel.update.mockRejectedValue(new Error("database error"));
    await BookingsController.handleBookingManagement(
      request({ id: "2" }, {}, { action: "update" }),
      res,
    );
    BookingsModel.delete.mockRejectedValue(new Error("database error"));
    await BookingsController.handleBookingManagement(
      request({ id: "2" }, {}, { action: "delete" }),
      res,
    );
  });

  test.each(["create", "update"])(
    "returns a conflict rather than success for overlapping member %s",
    async (action) => {
      jest
        .spyOn(BookingsModel, action)
        .mockResolvedValue({ affectedRows: 0, overlap: true });
      const res = response();
      await BookingsController.handleBookingManagement(
        request(
          action === "update" ? { id: "2" } : {},
          {},
          { action, sessionId: "4", userId: "7" },
          { id: 7, role: "member" },
        ),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.render).toHaveBeenCalledWith(
        "status.ejs",
        expect.objectContaining({
          message: "You already have a booking at this date and time.",
        }),
      );
      expect(res.redirect).not.toHaveBeenCalled();
      const apiRes = response();
      await BookingsController[action](
        request({ id: "2" }, {}, { session_id: 4, user_id: 7 }),
        apiRes,
        next(),
      );
      expect(apiRes.status).toHaveBeenCalledWith(409);
      expect(apiRes.json).toHaveBeenCalledWith({
        affectedRows: 0,
        overlap: true,
      });
    },
  );

  test("does not report duplicate member bookings as successful creations", async () => {
    jest
      .spyOn(BookingsModel, "create")
      .mockResolvedValue({ affectedRows: 0, duplicate: true });
    const res = response();
    await BookingsController.handleBookingManagement(
      request({}, {}, { action: "create" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
