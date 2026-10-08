import express from "express";
import { BookingsController } from "./BookingsController.mjs";
import { AuthenticationController } from "./AuthenticationController.mjs";
import { BookingsModel } from "../models/BookingsModel.mjs";
import { SessionsModel } from "../models/SessionsModel.mjs";
import { UsersModel } from "../models/UsersModel.mjs";
import { LocationModel } from "../models/LocationModel.mjs";
import { DatabaseModel } from "../models/DatabaseModel.mjs";
import { management } from "../utilities/formValidation.mjs";

const basePath = "/manage/bookings";
const canManageSession = (user, session) =>
  user.role === "admin" || Number(session.trainer_id) === Number(user.id);
const status = (res, code, message) =>
  res.status(code).render("status.ejs", {
    status: "Booking Management",
    message,
  });

/** Staff booking management, scoped to trainers' own sessions. */
export class BookingManagementController {
  static routes = express.Router();
  static formValidation = management(
    basePath,
    ["sessionId", "userId"],
    BookingsController.bookingFields,
    { sessionId: "session_id", userId: "user_id" },
  );

  static {
    this.routes.use(AuthenticationController.restrict(["admin"]));
    this.routes.get("/", this.view);
    this.routes.get("/:id", this.view);
    this.routes.post("/", this.formValidation, this.save);
    this.routes.post("/:id", this.formValidation, this.save);
  }

  /** Render searchable booking rows and the editor, using only authorised sessions. */
  static async view(req, res) {
    try {
      const [allBookings, allSessions, users, locations] = await Promise.all([
        BookingsModel.getAll(),
        SessionsModel.getAll(),
        UsersModel.getAll(),
        LocationModel.getAll(),
      ]);
      const sessions = allSessions.filter((session) =>
        canManageSession(req.authenticatedUser, session),
      );
      const sessionById = new Map(
        sessions.map((session) => [Number(session.id), session]),
      );
      const userById = new Map(users.map((user) => [Number(user.id), user]));
      const scopedBookings = allBookings.filter((booking) =>
        sessionById.has(Number(booking.session_id)),
      );
      const selectedBooking = req.params.id
        ? scopedBookings.find((booking) => String(booking.id) === req.params.id)
        : new BookingsModel(null, "", 0, "");
      if (!selectedBooking)
        return status(res, 404, "The booking could not be found.");
      const selectedSearchTerm = String(req.query.search_term ?? "").trim();
      const selectedTrainerId =
        req.authenticatedUser.role === "trainer"
          ? Number(req.authenticatedUser.id)
          : Number(req.query.trainer_id) || null;
      const selectedLocationId = Number(req.query.location_id) || null;
      const selectedSortBy = [
        "session",
        "session_date",
        "user",
        "trainer",
        "location",
        "created",
      ].includes(req.query.sort_by)
        ? req.query.sort_by
        : "session_date";
      const selectedSortDir = req.query.sort_dir === "desc" ? "desc" : "asc";
      const userName = (id) => {
        const user = userById.get(Number(id));
        return user ? `${user.last_name}, ${user.first_name}` : "Unknown user";
      };
      const today = DatabaseModel.toMySqlDate(new Date());
      const rows = scopedBookings
        .map((booking) => ({
          ...booking,
          session: sessionById.get(Number(booking.session_id)),
          userName: userName(booking.user_id),
          trainerName: userName(
            sessionById.get(Number(booking.session_id)).trainer_id,
          ),
          locationName:
            locations.find(
              (location) =>
                Number(location.id) ===
                Number(sessionById.get(Number(booking.session_id)).location_id),
            )?.name ?? "Unknown location",
        }))
        .filter(
          (booking) =>
            String(booking.session.date).slice(0, 10) >= today &&
            (!selectedTrainerId ||
              Number(booking.session.trainer_id) === selectedTrainerId) &&
            (!selectedLocationId ||
              Number(booking.session.location_id) === selectedLocationId) &&
            `${booking.session.title} ${booking.userName}`
              .toLowerCase()
              .includes(selectedSearchTerm.toLowerCase()),
        );
      const sortValue = (booking) =>
        selectedSortBy === "session"
          ? booking.session.title
          : selectedSortBy === "session_date"
            ? `${String(booking.session.date).slice(0, 10)} ${booking.session.time}`
            : selectedSortBy === "user"
              ? booking.userName
              : selectedSortBy === "trainer"
                ? booking.trainerName
                : selectedSortBy === "location"
                  ? booking.locationName
                  : String(booking.created);
      rows.sort(
        (left, right) =>
          (String(sortValue(left)).localeCompare(String(sortValue(right))) ||
            left.id - right.id) * (selectedSortDir === "asc" ? 1 : -1),
      );
      const totalPages = Math.max(1, Math.ceil(rows.length / 7));
      const page = Number(req.query.page);
      const selectedPage =
        Number.isSafeInteger(page) && page > 0 ? Math.min(page, totalPages) : 1;
      res.render("staff_booking_management.ejs", {
        bookings: rows.slice((selectedPage - 1) * 7, selectedPage * 7),
        sessions: sessions.filter(
          (session) => String(session.date).slice(0, 10) >= today,
        ),
        trainers: users.filter(
          (user) =>
            user.role === "trainer" &&
            (req.authenticatedUser.role === "admin" ||
              Number(user.id) === Number(req.authenticatedUser.id)),
        ),
        locations,
        selectedTrainerId,
        selectedLocationId,
        users: users.filter((user) => user.role === "member"),
        selectedBooking,
        selectedSearchTerm,
        selectedSortBy,
        selectedSortDir,
        selectedPage,
        totalPages,
        authenticatedUser: req.authenticatedUser,
        role: req.authenticatedUser.role,
      });
    } catch (error) {
      console.error(error);
      return status(res, 500, "Bookings could not be loaded.");
    }
  }

  /** Validate existing and destination session ownership before any write. */
  static async save(req, res) {
    try {
      const [sessions, users, bookings] = await Promise.all([
        SessionsModel.getAll(),
        UsersModel.getAll(),
        BookingsModel.getAll(),
      ]);
      const existing = req.params.id
        ? bookings.find((booking) => String(booking.id) === req.params.id)
        : null;
      if (req.body.action !== "create") {
        if (!existing)
          return status(res, 404, "The booking could not be found.");
        const session = sessions.find(
          (item) => Number(item.id) === Number(existing.session_id),
        );
        if (!session || !canManageSession(req.authenticatedUser, session)) {
          return status(
            res,
            403,
            "You can only manage bookings for your own sessions.",
          );
        }
      }
      if (req.body.action === "delete") {
        const result = await BookingsModel.delete(existing.id);
        if (!result.affectedRows)
          return status(res, 404, "The booking could not be found.");
      } else {
        const session = sessions.find(
          (item) => Number(item.id) === Number(req.body.sessionId),
        );
        if (!session) return status(res, 400, "Select an existing session.");
        if (!canManageSession(req.authenticatedUser, session)) {
          return status(
            res,
            403,
            "You can only manage bookings for your own sessions.",
          );
        }
        const user = users.find(
          (item) => Number(item.id) === Number(req.body.userId),
        );
        if (!user || user.role !== "member")
          return status(res, 400, "Select an existing member.");
        if (
          bookings.some(
            (booking) =>
              Number(booking.session_id) === Number(session.id) &&
              Number(booking.user_id) === Number(user.id) &&
              booking.id !== existing?.id,
          )
        ) {
          return status(
            res,
            409,
            "This member has already booked the session.",
          );
        }
        const booking = new BookingsModel(
          existing?.id ?? null,
          session.id,
          user.id,
          new Date(),
        );
        const result =
          req.body.action === "create"
            ? await BookingsModel.create(booking)
            : await BookingsModel.update(booking);
        if (result.duplicate)
          return status(
            res,
            409,
            "This member has already booked the session.",
          );
        if (result.overlap)
          return status(
            res,
            409,
            "This member already has a booking at this date and time.",
          );
        if (!result.affectedRows)
          return status(res, 404, "The booking could not be saved.");
      }
      return res.redirect(basePath);
    } catch (error) {
      console.error(error);
      return status(res, 500, "The booking could not be saved.");
    }
  }
}
