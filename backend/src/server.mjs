import { readFileSync } from "node:fs";
import express from "express";
import path from "path";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import pkg from "../package.json" with { type: "json" };
import { UsersController } from "./controllers/UsersController.mjs";
import { LocationController } from "./controllers/LocationController.mjs";
import { AuthenticationController } from "./controllers/AuthenticationController.mjs";
import { BlogController } from "./controllers/BlogController.mjs";
import { BookingsController } from "./controllers/BookingsController.mjs";
import { SessionsController } from "./controllers/SessionsController.mjs";
import { ActivitiesController } from "./controllers/ActivitiesController.mjs";
import { UsersModel } from "./models/UsersModel.mjs";
import { LocationModel } from "./models/LocationModel.mjs";
import { ActivitiesModel } from "./models/ActivitiesModel.mjs";
import { SessionsModel } from "./models/SessionsModel.mjs";
import { BookingsModel } from "./models/BookingsModel.mjs";
import {
  sanitiser,
  errorMiddleware,
  idempotencyMiddleware,
  devOptions,
  limiterOptions,
  rateLimit,
  corsOptions,
  swaggerSpec,
} from "./middleware/middlewareLoader.mjs";
import { logInfo } from "./utilities/logger.mjs";

let appVersion = pkg.version;
try {
  const rootPkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  if (rootPkg.version) {
    if (pkg.version !== "1.0.0" && rootPkg.version === "1.0.0") {
      appVersion = pkg.version;
    } else {
      appVersion = rootPkg.version;
    }
  }
} catch {
  // In Docker runtime or standalone, root package.json may not exist.
}

const app = express();
const port = process.env.PORT || 3000;

app.set("trust proxy", 1); // add reverse proxy support for correct client IP detection behind proxies
app.set("view engine", "ejs");
app.set("views", path.join(import.meta.dirname, "views"));
app.locals.version = appVersion;

app.use((req, res, next) => {
  res.locals.version = appVersion;
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit(limiterOptions);
app.use(cors(corsOptions));
app.use(limiter);
app.use(AuthenticationController.middleware);
app.use(sanitiser("reject"));
app.use(idempotencyMiddleware(devOptions));

console.log(
  logInfo,
  `Express-rate-limiter enabled.
                - Requests: ${limiterOptions.limit}
                - Period: ${limiterOptions.windowMs / 1000 / 60} minutes`,
);
console.log(logInfo, `Cors enabled, and allowing: ${corsOptions.origin}`);

app.use("/users", UsersController.routes);
app.use("/locations", LocationController.routes);
app.use("/blogs", BlogController.routes);
app.use("/bookings", BookingsController.routes);
app.use("/sessions", SessionsController.routes);
app.use("/activities", ActivitiesController.routes);
app.use("/authenticate", AuthenticationController.routes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Date range string boundaries covering today through seven days ahead.
const nextSevenDaysRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = new Date(today);
  lastDate.setDate(lastDate.getDate() + 7);
  const toLocalDateValue = (date) =>
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  return {
    firstDateValue: toLocalDateValue(today),
    lastDateValue: toLocalDateValue(lastDate),
  };
};

// Build the role-specific dashboard summary stats for the logged-in user.
const buildDashboardSummary = async (authenticatedUser) => {
  const { firstDateValue, lastDateValue } = nextSevenDaysRange();
  const isInNextSevenDays = (session) => {
    const dateValue = String(session.date).slice(0, 10);
    return dateValue >= firstDateValue && dateValue <= lastDateValue;
  };

  if (authenticatedUser.role === "admin") {
    const [users, locations, activities, sessions, bookings] =
      await Promise.all([
        UsersModel.getAll(),
        LocationModel.getAll(),
        ActivitiesModel.getAll(),
        SessionsModel.getAll(),
        BookingsModel.getAll(),
      ]);
    const upcomingSessions = sessions.filter(isInNextSevenDays);
    const upcomingSessionIds = new Set(
      upcomingSessions.map((session) => session.id),
    );
    return {
      totalMembers: users.filter((user) => user.role === "member").length,
      totalTrainers: users.filter((user) => user.role === "trainer").length,
      totalLocations: locations.length,
      totalActivities: activities.length,
      upcomingSessions: upcomingSessions.length,
      upcomingBookings: bookings.filter((booking) =>
        upcomingSessionIds.has(Number(booking.session_id)),
      ).length,
    };
  }

  if (authenticatedUser.role === "trainer") {
    const [sessions, bookings] = await Promise.all([
      SessionsModel.getAll(),
      BookingsModel.getAll(),
    ]);
    const mySessions = sessions.filter(
      (session) =>
        Number(session.trainer_id) === Number(authenticatedUser.id) &&
        isInNextSevenDays(session),
    );
    const mySessionIds = new Set(mySessions.map((session) => session.id));
    return {
      upcomingSessions: mySessions.length,
      upcomingBookings: bookings.filter((booking) =>
        mySessionIds.has(Number(booking.session_id)),
      ).length,
    };
  }

  if (authenticatedUser.role === "member") {
    const [bookings, sessions, locations] = await Promise.all([
      BookingsModel.getByUserId(authenticatedUser.id),
      SessionsModel.getAll(),
      LocationModel.getAll(),
    ]);
    const sessionsById = new Map(
      sessions.map((session) => [session.id, session]),
    );
    const locationsById = new Map(
      locations.map((location) => [location.id, location]),
    );
    const upcomingBookings = bookings
      .map((booking) => sessionsById.get(Number(booking.session_id)))
      .filter((session) => session && isInNextSevenDays(session))
      .sort((left, right) =>
        `${left.date}${left.time}`.localeCompare(`${right.date}${right.time}`),
      );
    const nextSession = upcomingBookings[0] ?? null;
    return {
      upcomingBookings: upcomingBookings.length,
      nextSession: nextSession && {
        ...nextSession,
        locationName:
          locationsById.get(Number(nextSession.location_id))?.name ??
          "Unknown location",
      },
    };
  }

  return null;
};

app.get("/", async (req, res) => {
  const authenticatedUser = req.authenticatedUser;
  const role = authenticatedUser?.role ?? "";
  let summary = null;
  if (authenticatedUser) {
    try {
      summary = await buildDashboardSummary(authenticatedUser);
    } catch (error) {
      console.error(error);
    }
  }
  res.render("dashboard.ejs", { authenticatedUser, role, summary });
});

app.use(express.static(path.join(import.meta.dirname, "public")));
app.use(express.static(path.join(import.meta.dirname, "dist")));
app.use(errorMiddleware());

app.listen(port, () => {
  console.log("Backend started on http://localhost:" + port);
});
