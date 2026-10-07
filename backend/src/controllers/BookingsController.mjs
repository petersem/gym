import express from "express";
import { BookingsModel } from "../models/BookingsModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { SessionsModel } from "../models/SessionsModel.mjs";
import { LocationModel } from "../models/LocationModel.mjs";
import { ActivitiesModel } from "../models/ActivitiesModel.mjs";
import XMLBuilder from "fast-xml-builder";
import { body } from "express-validator";
import { management } from "../utilities/formValidation.mjs";

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
});

const bookingsDtd = `<!DOCTYPE gymBookings [
<!ELEMENT gymBookings (booking*)>
<!ELEMENT booking (id, userId, user, created, session)>
<!ELEMENT id (#PCDATA)>
<!ELEMENT userId (#PCDATA)>
<!ELEMENT user (firstName, lastName)>
<!ELEMENT created (#PCDATA)>
<!ELEMENT session (id, title, date, time, activity, trainer, location)>
<!ELEMENT title (#PCDATA)>
<!ELEMENT date (#PCDATA)>
<!ELEMENT time (#PCDATA)>
<!ELEMENT activity (name, description)>
<!ELEMENT name (#PCDATA)>
<!ELEMENT description (#PCDATA)>
<!ELEMENT trainer (firstName, lastName)>
<!ELEMENT firstName (#PCDATA)>
<!ELEMENT lastName (#PCDATA)>
<!ELEMENT location (name, street, suburb, postcode)>
<!ELEMENT street (#PCDATA)>
<!ELEMENT suburb (#PCDATA)>
<!ELEMENT postcode (#PCDATA)>
]>`;

/**
 * Builds the bookings page URL while preserving the active filters.
 * @param {express.Request} req Current request.
 * @param {Object} [options] Result flags.
 * @returns {string} Bookings page URL.
 */
const bookingPageUrl = (
  req,
  { bookingDeleted = false, bookingCreated = false } = {},
) => {
  const query = new URLSearchParams();
  const isTimetable = req.baseUrl === "/timetable";
  if (isTimetable) {
    const availableLocationId = Number(req.query.available_location_id);
    if (Number.isInteger(availableLocationId) && availableLocationId > 0) {
      query.set("available_location_id", String(availableLocationId));
    }
  } else {
    if (req.query.booking_trainer_id === "all") {
      query.set("booking_trainer_id", "all");
    } else {
      const bookingTrainerId = Number(req.query.booking_trainer_id);
      if (Number.isInteger(bookingTrainerId) && bookingTrainerId > 0) {
        query.set("booking_trainer_id", String(bookingTrainerId));
      }
    }
    const bookingLocationId = Number(req.query.booking_location_id);
    if (Number.isInteger(bookingLocationId) && bookingLocationId > 0) {
      query.set("booking_location_id", String(bookingLocationId));
    }
  }
  if (bookingDeleted) {
    query.set("booking_deleted", "1");
  }
  if (bookingCreated) {
    query.set("booking_created", "1");
  }
  const search = query.toString();
  const path = isTimetable ? "/timetable" : "/bookings";
  return search ? `${path}?${search}` : path;
};

const trainerCanDeleteBooking = (trainerId, booking, session) =>
  Number(booking.user_id) === Number(trainerId) ||
  Number(session?.trainer_id) === Number(trainerId);

/**
 * BookingsController handles the management, viewing, and exporting of gym bookings.
 */
export class BookingsController {
  /** @type {express.Router} */
  static routes = express.Router();

  /** @type {express.Router} */
  static timetableRoutes = express.Router();

  static bookingFields = [
    body("sessionId")
      .custom((value) => typeof value === "string" || Number.isSafeInteger(value))
      .withMessage("Session must be a valid number.")
      .bail()
      .isInt({ min: 1, max: 2147483647, allow_leading_zeroes: false })
      .withMessage("Session must be an integer between 1 and 2147483647."),
    body("userId")
      .custom((value) => typeof value === "string" || Number.isSafeInteger(value))
      .withMessage("User must be a valid number.")
      .bail()
      .isInt({ min: 1, max: 2147483647, allow_leading_zeroes: false })
      .withMessage("User must be an integer between 1 and 2147483647."),
  ];

  /**
   * Validation for booking forms submitted to /bookings.
   * @type {express.RequestHandler[]}
   */
  static formValidation = management(
    "/bookings",
    ["sessionId", "userId"],
    this.bookingFields,
    { sessionId: "session_id", userId: "user_id" },
  );

  /**
   * Validation for booking forms submitted from the timetable.
   * @type {express.RequestHandler[]}
   */
  static timetableFormValidation = management(
    "/timetable",
    ["sessionId", "userId"],
    this.bookingFields,
    { sessionId: "session_id", userId: "user_id" },
  );

  static {
    this.routes.get("/", this.viewBookingManagement);
    this.routes.get("/export.xml", this.exportBookingsXml);
    this.routes.get("/:id", this.viewBookingManagement);
    this.routes.post("/", this.formValidation, this.handleBookingManagement);
    this.routes.post("/:id", this.formValidation, this.handleBookingManagement);
    this.timetableRoutes.get("/", this.viewTimetable);
    this.timetableRoutes.post(
      "/",
      this.timetableFormValidation,
      this.handleBookingManagement,
    );
  }

  /** @type {express.RequestHandler} */
  static async exportBookingsXml(req, res, next) {
    const authenticatedUser = req.authenticatedUser;
    if (!authenticatedUser) {
      return res.status(401).send("Authentication required.");
    }

    try {
      const canManageBookings = ["admin", "trainer"].includes(
        authenticatedUser.role,
      );
      const [bookings, sessions, locations, activities, users] =
        await Promise.all([
          canManageBookings
            ? BookingsModel.getAll()
            : BookingsModel.getByUserId(authenticatedUser.id),
          SessionsModel.getAll(),
          LocationModel.getAll(),
          ActivitiesModel.getAll(),
          UsersModel.getAll(),
        ]);

      const selectedUserId = canManageBookings
        ? Number(req.query.booking_user_id) || null
        : Number(authenticatedUser.id);
      const selectedTrainerId = canManageBookings
        ? Number(req.query.booking_trainer_id) || null
        : null;
      const selectedLocationId = Number(req.query.booking_location_id) || null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 7);
      const dateValue = (date) =>
        [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");
      const firstDateValue = dateValue(today);
      const endDateValue = dateValue(endDate);
      const ownBookingSessionIds = new Set();
      if (authenticatedUser.role === "trainer") {
        bookings.forEach((booking) => {
          if (Number(booking.user_id) === Number(authenticatedUser.id)) {
            ownBookingSessionIds.add(Number(booking.session_id));
          }
        });
      }

      const visibleSessions = sessions
        .filter((session) => {
          const sessionDate = String(session.date).slice(0, 10);
          const matchesDate =
            sessionDate >= firstDateValue && sessionDate < endDateValue;
          const matchesLocation =
            !selectedLocationId ||
            Number(session.location_id) === selectedLocationId;
          const matchesTrainer =
            !selectedTrainerId ||
            Number(session.trainer_id) === selectedTrainerId ||
            ownBookingSessionIds.has(Number(session.id));
          return matchesDate && matchesLocation && matchesTrainer;
        })
        .sort(
          (left, right) =>
            String(left.date).localeCompare(String(right.date)) ||
            String(left.time).localeCompare(String(right.time)),
        );
      const sessionsById = new Map(
        visibleSessions.map((session) => [Number(session.id), session]),
      );
      const selectedBookings = bookings
        .filter(
          (booking) =>
            sessionsById.has(Number(booking.session_id)) &&
            (!selectedUserId || Number(booking.user_id) === selectedUserId),
        )
        .sort((left, right) => {
          const leftSession = sessionsById.get(Number(left.session_id));
          const rightSession = sessionsById.get(Number(right.session_id));
          return (
            String(leftSession.date).localeCompare(String(rightSession.date)) ||
            String(leftSession.time).localeCompare(String(rightSession.time))
          );
        });
      const bookingRecords = selectedBookings.map((booking) => {
        const session = sessionsById.get(Number(booking.session_id));
        const location =
          locations.find(
            (item) => Number(item.id) === Number(session.location_id),
          ) ?? {};
        const activity =
          activities.find(
            (item) => Number(item.id) === Number(session.activity_id),
          ) ?? {};
        const trainer =
          users.find(
            (user) => Number(user.id) === Number(session.trainer_id),
          ) ?? {};
        const bookingUser =
          users.find((user) => Number(user.id) === Number(booking.user_id)) ??
          {};

        return {
          id: String(booking.id),
          userId: String(booking.user_id),
          user: {
            firstName: String(bookingUser.first_name ?? ""),
            lastName: String(bookingUser.last_name ?? ""),
          },
          created: String(booking.created ?? ""),
          session: {
            id: String(session.id),
            title: String(session.title ?? ""),
            date: String(session.date).slice(0, 10),
            time: String(session.time ?? "").slice(0, 8),
            activity: {
              name: String(activity.name ?? ""),
              description: String(activity.description ?? ""),
            },
            trainer: {
              firstName: String(trainer.first_name ?? ""),
              lastName: String(trainer.last_name ?? ""),
            },
            location: {
              name: String(location.name ?? ""),
              street: String(location.street ?? ""),
              suburb: String(location.suburb ?? ""),
              postcode: String(location.postcode ?? ""),
            },
          },
        };
      });
      const xml = xmlBuilder.build({
        "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
        gymBookings: { booking: bookingRecords },
      });

      res.set({
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="gym-bookings.xml"',
      });
      const declarationEnd = xml.indexOf("?>") + 2;
      const document = `${xml.slice(0, declarationEnd)}\n${bookingsDtd}\n${xml.slice(declarationEnd).trimStart()}`;
      return res.send(document);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Renders the booking management page. Admins and trainers see all bookings;
   * members see only their own. Loads the booking in the URL into the edit form.
   * @type {express.RequestHandler}
   */
  static viewBookingManagement(req, res) {
    return BookingsController.renderManagementPage(req, res, "bookings");
  }

  /** @type {express.RequestHandler} */
  static viewTimetable(req, res) {
    return BookingsController.renderManagementPage(req, res, "timetable");
  }

  static renderManagementPage(req, res, page) {
    const canManageBookings = ["admin", "trainer"].includes(
      req.authenticatedUser?.role,
    );
    const bookingsPromise = req.authenticatedUser?.id
      ? BookingsModel.getByUserId(req.authenticatedUser.id)
      : Promise.resolve([]);
    return Promise.all([
      bookingsPromise,
      UsersModel.getAll(),
      SessionsModel.getAll(),
      LocationModel.getAll(),
      ActivitiesModel.getAll(),
    ])
      .then(([bookings, users, sessions, locations, activities]) => {
        const selectedBooking =
          bookings.find((booking) => String(booking.id) === req.params.id) ??
          new BookingsModel(null, req.query.session_id ?? "", 0, "");
        const availableLocationId =
          Number(req.query.available_location_id) || null;
        const bookingLocationId = Number(req.query.booking_location_id) || null;
        const bookingTrainerIdParam = req.query.booking_trainer_id;
        const bookingUserId = req.authenticatedUser?.id ?? null;
        const bookingTrainerId = canManageBookings
          ? Number(bookingTrainerIdParam) || null
          : null;
        const availableSessions = availableLocationId
          ? sessions.filter(
              (session) => Number(session.location_id) === availableLocationId,
            )
          : sessions;
        const bookingSessions = sessions.filter((session) => {
          const matchesLocation =
            !bookingLocationId ||
            Number(session.location_id) === bookingLocationId;
          // A trainer's own bookings stay visible even under sessions taught by other trainers.
          const isOwnBooking =
            req.authenticatedUser?.role === "trainer" &&
            bookings.some(
              (booking) =>
                Number(booking.session_id) === Number(session.id) &&
                Number(booking.user_id) === Number(req.authenticatedUser.id),
            );
          const matchesTrainer =
            !bookingTrainerId ||
            Number(session.trainer_id) === Number(bookingTrainerId) ||
            isOwnBooking;
          return matchesLocation && matchesTrainer;
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const byTime = (left, right) =>
          String(left.time).localeCompare(String(right.time));
        const calendarDays = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(today);
          date.setDate(today.getDate() + index);
          const dateValue = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0"),
          ].join("-");
          const daySessions = availableSessions
            .filter(
              (session) => String(session.date).slice(0, 10) === dateValue,
            )
            .sort(byTime);
          return {
            dateValue,
            label: `${date.toLocaleDateString("en-AU", { weekday: "short" }).slice(0, 3)} ${date.getDate()} ${date.toLocaleDateString("en-AU", { month: "short" }).slice(0, 3)}`,
            bookings: bookings
              .filter((booking) =>
                daySessions.some(
                  (session) => session.id === Number(booking.session_id),
                ),
              )
              .sort((left, right) =>
                byTime(
                  daySessions.find(
                    (session) => session.id === Number(left.session_id),
                  ),
                  daySessions.find(
                    (session) => session.id === Number(right.session_id),
                  ),
                ),
              ),
            sessions: daySessions,
          };
        });
        const bookingCalendarDays = calendarDays
          .map((day) => ({
            ...day,
            sessions: bookingSessions
              .filter(
                (session) =>
                  String(session.date).slice(0, 10) === day.dateValue,
              )
              .sort(byTime),
          }))
          .map((day) => ({
            ...day,
            bookings: bookings
              .filter(
                (booking) =>
                  day.sessions.some(
                    (session) => session.id === Number(booking.session_id),
                  ) &&
                  (!bookingUserId ||
                    Number(booking.user_id) === Number(bookingUserId)),
              )
              .sort((left, right) =>
                byTime(
                  day.sessions.find(
                    (session) => session.id === Number(left.session_id),
                  ),
                  day.sessions.find(
                    (session) => session.id === Number(right.session_id),
                  ),
                ),
              ),
          }));
        res.render("booking_management.ejs", {
          bookings,
          users,
          sessions: availableSessions,
          locations,
          activities,
          calendarDays,
          bookingCalendarDays,
          selectedBooking,
          availableLocationId,
          bookingLocationId,
          bookingTrainerId,
          bookingUserId,
          canManageBookings,
          canDeleteBooking: (booking, session) =>
            req.authenticatedUser?.role !== "trainer" ||
            trainerCanDeleteBooking(req.authenticatedUser.id, booking, session),
          bookingDeleted: req.query.booking_deleted === "1",
          bookingCreated: req.query.booking_created === "1",
          showAvailableSessions: page === "timetable",
          showBookings: page === "bookings",
          pageTitle: page === "timetable" ? "Timetable" : "Bookings",
          authenticatedUser: req.authenticatedUser,
          role: "admin",
        });
      })
      .catch((error) => {
        console.error(error);
        res.status(500).render("status.ejs", {
          status: "Database Error",
          message: "Bookings could not be loaded.",
        });
      });
  }

  /**
   * Creates, updates or deletes a booking from the validated management form.
   * @type {express.RequestHandler}
   */
  static handleBookingManagement(req, res) {
    const booking = new BookingsModel(
      req.params.id ? Number(req.params.id) : null,
      req.body.sessionId ?? req.body.session_id,
      Number(req.body.userId ?? req.body.user_id ?? 0),
      req.body.action === "create" ? new Date() : undefined,
    );

    if (req.body.action === "create") {
      return BookingsModel.create(booking)
        .then(() => res.redirect(bookingPageUrl(req, { bookingCreated: true })))
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The booking could not be created.",
          });
        });
    } else if (req.body.action === "update") {
      return BookingsModel.update(booking)
        .then((result) =>
          result.affectedRows > 0
            ? res.redirect(bookingPageUrl(req))
            : res.status(404).render("status.ejs", {
                status: "Booking Update Failed",
                message: "The booking could not be found.",
              }),
        )
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The booking could not be updated.",
          });
        });
    } else if (req.body.action === "delete") {
      const deleteBooking =
        req.authenticatedUser?.role === "trainer"
          ? BookingsModel.getById(booking.id)
              .then((existingBooking) =>
                SessionsModel.getById(existingBooking.session_id).then(
                  (session) => ({ existingBooking, session }),
                ),
              )
              .then(({ existingBooking, session }) => {
                if (
                  !trainerCanDeleteBooking(
                    req.authenticatedUser.id,
                    existingBooking,
                    session,
                  )
                ) {
                  res.status(403).render("status.ejs", {
                    status: "Booking Deletion Forbidden",
                    message:
                      "You can only delete bookings for your own sessions or your own bookings",
                  });
                  return;
                }
                return BookingsModel.delete(booking.id);
              })
          : BookingsModel.delete(booking.id);
      return deleteBooking
        .then((result) =>
          result == null
            ? undefined
            : result.affectedRows > 0
              ? res.redirect(bookingPageUrl(req, { bookingDeleted: true }))
              : res.status(404).render("status.ejs", {
                  status: "Booking Deletion Failed",
                  message: "The booking could not be found.",
                }),
        )
        .catch((error) => {
          console.error(error);
          res.status(500).render("status.ejs", {
            status: "Database Error",
            message: "The booking could not be deleted.",
          });
        });
    } else {
      res.status(400).render("status.ejs", {
        status: "Invalid Action",
        message: "The form doesn't support this action.",
      });
    }
  }

  /** @type {express.RequestHandler} */
  static async list(req, res, next) {
    try {
      res.json(await BookingsModel.getAll());
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async getById(req, res, next) {
    try {
      res.json(await BookingsModel.getById(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async create(req, res, next) {
    try {
      const result = await BookingsModel.create(req.body);
      res.status(result.duplicate ? 409 : 201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async update(req, res, next) {
    try {
      res.json(
        await BookingsModel.update({ ...req.body, id: Number(req.params.id) }),
      );
    } catch (error) {
      next(error);
    }
  }

  /** @type {express.RequestHandler} */
  static async delete(req, res, next) {
    try {
      res.json(await BookingsModel.delete(Number(req.params.id)));
    } catch (error) {
      next(error);
    }
  }
}
