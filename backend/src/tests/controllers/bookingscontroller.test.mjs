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

  test("applies manager filters when exporting bookings", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayValue = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const bookings = [
      { id: 201, session_id: 21, user_id: 7 },
      { id: 202, session_id: 22, user_id: 8 },
      { id: 203, session_id: 23, user_id: 7 },
      { id: 204, session_id: 24, user_id: 7 },
    ];
    const getAll = jest
      .spyOn(BookingsModel, "getAll")
      .mockResolvedValue(bookings);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue([
      {
        id: 21,
        title: "Selected session",
        activity_id: 3,
        location_id: 9,
        trainer_id: 12,
        date: todayValue,
        time: "09:00:00",
      },
      {
        id: 22,
        title: "Other member",
        activity_id: 3,
        location_id: 9,
        trainer_id: 12,
        date: todayValue,
        time: "10:00:00",
      },
      {
        id: 23,
        title: "Other trainer",
        activity_id: 3,
        location_id: 9,
        trainer_id: 13,
        date: todayValue,
        time: "11:00:00",
      },
      {
        id: 24,
        title: "Other location",
        activity_id: 3,
        location_id: 10,
        trainer_id: 12,
        date: todayValue,
        time: "12:00:00",
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
        { id: 3, name: "Strength", description: "Build strength." },
      ]);
    jest
      .spyOn(UsersModel, "getAll")
      .mockResolvedValue([
        { id: 12, first_name: "Taylor", last_name: "Trainer" },
      ]);
    const res = response();

    await BookingsController.exportBookingsXml(
      request(
        {},
        {
          booking_user_id: "7",
          booking_trainer_id: "12",
          booking_location_id: "9",
        },
        {},
        { id: 1, role: "admin" },
      ),
      res,
      next(),
    );

    expect(getAll).toHaveBeenCalled();
    expect(res.send.mock.calls[0][0]).toContain("Selected session");
    expect(res.send.mock.calls[0][0]).not.toContain("Other member");
    expect(res.send.mock.calls[0][0]).not.toContain("Other trainer");
    expect(res.send.mock.calls[0][0]).not.toContain("Other location");
  });

  test("exports bookings XML when all-trainer filter is selected", async () => {
    jest.spyOn(BookingsModel, "getAll").mockResolvedValue([]);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue([]);
    jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    const res = response();

    await BookingsController.exportBookingsXml(
      request(
        {},
        {
          booking_user_id: "",
          booking_trainer_id: "",
          booking_location_id: "",
        },
        {},
        { id: 1, role: "admin" },
      ),
      res,
      next(),
    );

    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining("<gymBookings></gymBookings>"),
    );
  });

  test("keeps a trainer's own bookings when a different trainer filter is selected", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateValue = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    jest.spyOn(BookingsModel, "getAll").mockResolvedValue([
      { id: 301, session_id: 31, user_id: 12 },
      { id: 302, session_id: 32, user_id: 7 },
    ]);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue([
      {
        id: 31,
        title: "Trainer's own booking",
        activity_id: 3,
        location_id: 9,
        trainer_id: 13,
        date: dateValue,
        time: "09:00:00",
      },
      {
        id: 32,
        title: "Selected trainer",
        activity_id: 3,
        location_id: 9,
        trainer_id: 13,
        date: dateValue,
        time: "10:00:00",
      },
      {
        id: 33,
        title: "Unselected trainer",
        activity_id: 3,
        location_id: 9,
        trainer_id: 14,
        date: dateValue,
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
        { id: 3, name: "Strength", description: "Build strength." },
      ]);
    jest
      .spyOn(UsersModel, "getAll")
      .mockResolvedValue([
        { id: 13, first_name: "Jamie", last_name: "Trainer" },
      ]);
    const res = response();

    await BookingsController.exportBookingsXml(
      request(
        {},
        { booking_user_id: "", booking_trainer_id: "13" },
        {},
        { id: 12, role: "trainer" },
      ),
      res,
      next(),
    );

    expect(res.send.mock.calls[0][0]).toContain("Trainer&apos;s own booking");
    expect(res.send.mock.calls[0][0]).toContain("Selected trainer");
    expect(res.send.mock.calls[0][0]).not.toContain("Unselected trainer");
  });

  test("exports empty XML fields when related booking metadata is missing", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    jest
      .spyOn(BookingsModel, "getByUserId")
      .mockResolvedValue([
        { id: 401, session_id: 41, user_id: 7, created: "2026-10-02 09:00:00" },
      ]);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue([
      {
        id: 41,
        title: null,
        activity_id: 30,
        location_id: 90,
        trainer_id: 120,
        date,
        time: null,
      },
    ]);
    jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    const res = response();

    await BookingsController.exportBookingsXml(
      request({}, {}, {}, { id: 7, role: "member" }),
      res,
      next(),
    );

    const xml = res.send.mock.calls[0][0];
    expect(xml).toContain("<created>2026-10-02 09:00:00</created>");
    expect(xml).toMatch(
      /<user>\s*<firstName><\/firstName>\s*<lastName><\/lastName>\s*<\/user>/,
    );
    expect(xml).toContain("<title></title>");
    expect(xml).toContain("<time></time>");
    expect(xml).toContain("<activity>");
    expect(xml).toContain("<name></name>");
    expect(xml).toContain("<description></description>");
    expect(xml).toContain("<trainer>");
    expect(xml).toContain("<firstName></firstName>");
    expect(xml).toContain("<lastName></lastName>");
    expect(xml).toContain("<location>");
    expect(xml).toContain("<street></street>");
    expect(xml).toContain("<suburb></suburb>");
    expect(xml).toContain("<postcode></postcode>");
  });

  test("forwards bookings XML export errors", async () => {
    const error = new Error("database error");
    const errorNext = next();
    jest.spyOn(BookingsModel, "getByUserId").mockRejectedValue(error);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue([]);
    jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);

    await BookingsController.exportBookingsXml(
      request({}, {}, {}, { id: 7, role: "member" }),
      response(),
      errorNext,
    );

    expect(errorNext).toHaveBeenCalledWith(error);
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

  test("does not load any bookings when the request is unauthenticated", async () => {
    const getByUserId = jest.spyOn(BookingsModel, "getByUserId");
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue([]);
    jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
    const res = response();

    await BookingsController.viewBookingManagement(request(), res);

    expect(getByUserId).not.toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith(
      "booking_management.ejs",
      expect.objectContaining({ bookings: [] }),
    );
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

  test("handles empty and all trainer filters and preserves positive filters in redirects", async () => {
    const getAll = jest.spyOn(BookingsModel, "getAll").mockResolvedValue([]);
    const getByUserId = jest
      .spyOn(BookingsModel, "getByUserId")
      .mockResolvedValue([]);
    jest.spyOn(BookingsModel, "create").mockResolvedValue({ insertId: 1 });
    jest.spyOn(BookingsModel, "delete").mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    jest.spyOn(SessionsModel, "getAll").mockResolvedValue([]);
    jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
    const res = response();

    await BookingsController.viewBookingManagement(
      request(
        {},
        {
          booking_user_id: "0",
          booking_trainer_id: "all",
        },
        {},
        { role: "admin" },
      ),
      res,
    );
    expect(res.render.mock.calls.at(-1)[1]).toEqual(
      expect.objectContaining({
        bookingUserId: null,
        bookingTrainerId: null,
      }),
    );

    await BookingsController.viewBookingManagement(
      request({}, {}, {}, { role: "admin" }),
      res,
    );
    expect(res.render.mock.calls.at(-1)[1].bookingUserId).toBeNull();

    await BookingsController.viewBookingManagement(
      request(
        {},
        {
          booking_trainer_id: "all",
        },
        {},
        { id: 12, role: "trainer" },
      ),
      res,
    );
    expect(res.render.mock.calls.at(-1)[1].bookingTrainerId).toBeNull();

    await BookingsController.viewBookingManagement(
      request(
        {},
        {
          booking_trainer_id: "0",
        },
        {},
        { id: 1, role: "trainer" },
      ),
      res,
    );
    expect(res.render.mock.calls.at(-1)[1].bookingTrainerId).toBeNull();

    getByUserId.mockClear();
    getAll.mockClear();
    await BookingsController.viewBookingManagement(request(), res);
    await BookingsController.viewBookingManagement(
      request({}, {}, {}, { role: "member" }),
      res,
    );
    expect(getByUserId).not.toHaveBeenCalled();
    expect(res.render.mock.calls.at(-1)[1].bookingUserId).toBeNull();

    await BookingsController.viewBookingManagement(
      request({}, {}, {}, { role: "trainer" }),
      res,
    );
    expect(res.render.mock.calls.at(-1)[1].bookingTrainerId).toBeNull();
    expect(getAll).not.toHaveBeenCalled();

    await BookingsController.handleBookingManagement(
      request(
        {},
        {
          booking_user_id: "8",
          booking_trainer_id: "5",
          booking_location_id: "3",
        },
        { action: "create" },
      ),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(
      "/bookings?booking_trainer_id=5&booking_location_id=3&booking_created=1",
    );
    await BookingsController.handleBookingManagement(
      request({}, { booking_trainer_id: "all" }, { action: "create" }),
      res,
    );
    expect(res.redirect).toHaveBeenLastCalledWith(
      "/bookings?booking_trainer_id=all&booking_created=1",
    );
    await BookingsController.handleBookingManagement(
      request(
        {},
        {
          booking_trainer_id: "0",
        },
        { action: "create" },
      ),
      res,
    );
    expect(res.redirect).toHaveBeenLastCalledWith(
      "/bookings?booking_created=1",
    );

    await BookingsController.handleBookingManagement(
      request(
        {},
        {
          booking_user_id: "all",
        },
        { action: "delete" },
      ),
      res,
    );
    expect(res.redirect).toHaveBeenLastCalledWith(
      "/bookings?booking_deleted=1",
    );
  });

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

  test("renders the timetable and bookings on separate routes", async () => {
    const date = new Date().toISOString().slice(0, 10);
    jest.spyOn(BookingsModel, "getByUserId").mockResolvedValue([]);
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    jest
      .spyOn(SessionsModel, "getAll")
      .mockResolvedValue([{ id: 1, date, time: "10:00:00" }]);
    jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
    jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
    const res = response();
    const authenticatedUser = { id: 7, role: "member" };
    const template = fileURLToPath(
      new URL("../../views/booking_management.ejs", import.meta.url),
    );

    await BookingsController.viewTimetable(
      request({}, {}, {}, authenticatedUser),
      res,
    );
    const timetableLocals = res.render.mock.calls.at(-1)[1];
    const timetableHtml = await ejs.renderFile(template, timetableLocals);
    expect(timetableLocals.pageTitle).toBe("Timetable");
    expect(timetableHtml).toContain("Available sessions next 7 days");
    expect(timetableHtml).not.toContain("Bookings next 7 days");

    await BookingsController.viewTimetable(
      request({}, { booking_created: "1" }, {}, authenticatedUser),
      res,
    );
    const createdTimetableLocals = res.render.mock.calls.at(-1)[1];
    const createdTimetableHtml = await ejs.renderFile(
      template,
      createdTimetableLocals,
    );
    expect(createdTimetableHtml).toContain("Booking added.");

    await BookingsController.viewBookingManagement(
      request({}, {}, {}, authenticatedUser),
      res,
    );
    const bookingsLocals = res.render.mock.calls.at(-1)[1];
    const bookingsHtml = await ejs.renderFile(template, bookingsLocals);
    expect(bookingsLocals.pageTitle).toBe("Bookings");
    expect(bookingsHtml).not.toContain("Available sessions next 7 days");
    expect(bookingsHtml).toContain("Bookings next 7 days");
  });

  test("handles booking CRUD requests", async () => {
    const res = response();
    const errorNext = next();
    jest.spyOn(BookingsModel, "getAll").mockResolvedValue([{ id: 1 }]);
    jest.spyOn(BookingsModel, "getById").mockResolvedValue({ id: 1 });
    jest.spyOn(BookingsModel, "create").mockResolvedValue({ insertId: 1 });
    jest.spyOn(BookingsModel, "update").mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(BookingsModel, "delete").mockResolvedValue({ affectedRows: 1 });

    await BookingsController.list(request(), res, errorNext);
    await BookingsController.getById(request({ id: "1" }), res, errorNext);
    await BookingsController.create(
      request({}, {}, { user_id: 7 }),
      res,
      errorNext,
    );
    await BookingsController.update(
      request({ id: "1" }, {}, { user_id: 8 }),
      res,
      errorNext,
    );
    await BookingsController.delete(request({ id: "1" }), res, errorNext);

    BookingsModel.create.mockResolvedValueOnce({
      affectedRows: 0,
      duplicate: true,
    });
    await BookingsController.create(
      request({}, {}, { session_id: 4, user_id: 7 }),
      res,
      errorNext,
    );

    expect(BookingsModel.update).toHaveBeenCalledWith({ user_id: 8, id: 1 });
    expect(BookingsModel.delete).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.status).toHaveBeenCalledWith(409);
  });

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

  test("allows trainers to delete their own bookings or bookings for their own sessions", async () => {
    jest
      .spyOn(BookingsModel, "getById")
      .mockResolvedValue({ id: 2, session_id: 9 });
    jest
      .spyOn(SessionsModel, "getById")
      .mockResolvedValue({ id: 9, trainer_id: 12 });
    const deleteBooking = jest
      .spyOn(BookingsModel, "delete")
      .mockResolvedValue({ affectedRows: 1 });
    const res = response();
    const trainer = { id: 12, role: "trainer" };

    await BookingsController.handleBookingManagement(
      request({ id: "2" }, {}, { action: "delete" }, trainer),
      res,
    );
    expect(deleteBooking).toHaveBeenCalledWith(2);

    SessionsModel.getById.mockResolvedValue({ id: 9, trainer_id: 13 });
    BookingsModel.getById.mockResolvedValue({
      id: 2,
      session_id: 9,
      user_id: "12",
    });
    await BookingsController.handleBookingManagement(
      request({ id: "2" }, {}, { action: "delete" }, trainer),
      res,
    );
    expect(deleteBooking).toHaveBeenCalledTimes(2);

    BookingsModel.getById.mockResolvedValue({
      id: 2,
      session_id: 9,
      user_id: 14,
    });
    res.render.mockReturnValue(res);
    res.redirect.mockClear();
    res.status.mockClear();
    await BookingsController.handleBookingManagement(
      request(
        { id: "2" },
        {},
        { action: "delete", userId: 12, sessionId: 99 },
        trainer,
      ),
      res,
    );
    expect(deleteBooking).toHaveBeenCalledTimes(2);
    expect(res.status.mock.calls).toEqual([[403]]);
    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.render).toHaveBeenCalledWith(
      "status.ejs",
      expect.objectContaining({
        status: "Booking Deletion Forbidden",
      }),
    );
  });

  test.each(["trainer", "admin"])(
    "%s sees only their own bookings with deletion controls matching ownership",
    async (role) => {
      const today = new Date();
      const date = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");
      const sessions = [
        { id: 9, trainer_id: 12, title: "Own session", date, time: "09:00:00" },
        {
          id: 10,
          trainer_id: 13,
          title: "Other session",
          date,
          time: "10:00:00",
        },
      ];
      const bookings = [
        { id: 1, session_id: 9, user_id: 14 },
        { id: 2, session_id: 10, user_id: "12" },
        { id: 3, session_id: 10, user_id: 14 },
      ];
      jest
        .spyOn(BookingsModel, "getByUserId")
        .mockResolvedValue(bookings.filter((booking) => Number(booking.user_id) === 12));
      jest.spyOn(SessionsModel, "getAll").mockResolvedValue(sessions);
      jest.spyOn(UsersModel, "getAll").mockResolvedValue([
        { id: 12, role: "trainer", first_name: "Own", last_name: "Trainer" },
        { id: 13, role: "trainer", first_name: "Other", last_name: "Trainer" },
        { id: 14, role: "member", first_name: "Test", last_name: "Member" },
      ]);
      jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
      jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);
      const res = response();
      await BookingsController.viewBookingManagement(
        request({ id: "2" }, { booking_user_id: "all" }, {}, { id: "12", role }),
        res,
      );
      const locals = res.render.mock.calls[0][1];
      expect(locals.bookingUserId).toBe("12");
      expect(locals.bookingCalendarDays[0].bookings).toEqual([bookings[1]]);
      const html = await ejs.renderFile(
        fileURLToPath(
          new URL("../../views/booking_management.ejs", import.meta.url),
        ),
        locals,
      );
      expect(html).toContain("Other session");
      expect(html).not.toContain("Own session</");
      expect(html).not.toContain('id="booking-user-filter"');
      const trainerSelect = html.match(
        /<select id="booking-trainer-filter"[\s\S]*?<\/select>/,
      )[0];
      expect(trainerSelect).toContain("All trainers");
      expect(trainerSelect).toContain('value="12"');
      expect(trainerSelect).toContain('value="13"');
      expect(html).toMatch(/href="\/bookings\/2\?/);
      expect(/value="delete"/.test(html)).toBe(true);
      expect(html).not.toMatch(/href="\/bookings\/1\?/);
      expect(html).not.toMatch(/href="\/bookings\/3\?/);
    },
  );

  test.each(["admin", "trainer"])(
    "%s booking filters only show their own bookings",
    async (role) => {
      const dateForOffset = (offset) => {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");
      };
      const sessions = [
        { id: 1, trainer_id: 12, location_id: 1, date: dateForOffset(0) },
        { id: 2, trainer_id: 13, location_id: 2, date: dateForOffset(6) },
        { id: 3, trainer_id: 12, location_id: 1, date: dateForOffset(-1) },
        { id: 4, trainer_id: 12, location_id: 1, date: dateForOffset(7) },
      ].map((session) => ({
        ...session,
        title: `Session ${session.id}`,
        time: "09:00:00",
      }));
      jest.spyOn(SessionsModel, "getAll").mockResolvedValue(sessions);
      const ownBookings = [
        { id: 1, session_id: 1, user_id: "21" },
        { id: 3, session_id: 2, user_id: 21 },
        { id: 4, session_id: 3, user_id: 21 },
        { id: 5, session_id: 4, user_id: 21 },
      ];
      jest
        .spyOn(BookingsModel, "getByUserId")
        .mockResolvedValue(ownBookings);
      jest.spyOn(BookingsModel, "getAll");
      jest.spyOn(UsersModel, "getAll").mockResolvedValue([
        { id: 12, role: "trainer", first_name: "Own", last_name: "Trainer" },
        { id: 13, role: "trainer", first_name: "Other", last_name: "Trainer" },
        ...[21, 22, 23, 24, 25].map((id) => ({
          id: String(id),
          role: "member",
          first_name: "User",
          last_name: String(id),
        })),
      ]);
      jest.spyOn(LocationModel, "getAll").mockResolvedValue([]);
      jest.spyOn(ActivitiesModel, "getAll").mockResolvedValue([]);

      const cases = [
        [{}, [1, 3]],
        [{ booking_location_id: "1" }, [1]],
        [{ booking_trainer_id: "13" }, role === "trainer" ? [1, 3] : [3]],
        [{ booking_user_id: "22" }, [1, 3]],
        [{ booking_user_id: "25" }, [1, 3]],
        [{ booking_location_id: "1", booking_user_id: "22" }, [1]],
        [
          { booking_trainer_id: "13", booking_user_id: "21" },
          role === "trainer" ? [1, 3] : [3],
        ],
        [
          {
            booking_location_id: "2",
            booking_trainer_id: "13",
            booking_user_id: "22",
          },
          [3],
        ],
        [{ booking_location_id: "99" }, []],
      ];
      for (const [filters, expectedBookingIds] of cases) {
        const res = response();
        await BookingsController.viewBookingManagement(
          request(
            {},
            { booking_user_id: "all", ...filters },
            {},
            { id: 21, role },
          ),
          res,
        );
        const locals = res.render.mock.calls[0][1];
        const shownBookings = locals.bookingCalendarDays.flatMap(
          (day) => day.bookings,
        );
        expect(shownBookings.map((booking) => booking.id)).toEqual(
          expectedBookingIds,
        );
        expect(
          shownBookings.every((booking) => Number(booking.user_id) === 21),
        ).toBe(true);
        const html = await ejs.renderFile(
          fileURLToPath(
            new URL("../../views/booking_management.ejs", import.meta.url),
          ),
          locals,
        );
        expect(html).not.toContain('id="booking-user-filter"');
      }
    },
  );

  test("forwards errors from booking JSON handlers", async () => {
    const error = new Error("database error");
    const errorNext = next();
    jest.spyOn(BookingsModel, "getById").mockRejectedValue(error);
    jest.spyOn(BookingsModel, "create").mockRejectedValue(error);
    jest.spyOn(BookingsModel, "update").mockRejectedValue(error);
    jest.spyOn(BookingsModel, "delete").mockRejectedValue(error);
    const res = response();

    await BookingsController.getById(request({ id: "1" }), res, errorNext);
    await BookingsController.create(request(), res, errorNext);
    await BookingsController.update(request({ id: "1" }), res, errorNext);
    await BookingsController.delete(request({ id: "1" }), res, errorNext);

    expect(errorNext).toHaveBeenCalledTimes(4);
  });

  test("forwards booking errors", async () => {
    const error = new Error("database error");
    const errorNext = next();
    jest.spyOn(BookingsModel, "getAll").mockRejectedValue(error);

    await BookingsController.list(request(), response(), errorNext);

    expect(errorNext).toHaveBeenCalledWith(error);
  });
});
