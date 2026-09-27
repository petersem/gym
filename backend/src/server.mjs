import express from "express";
import path from "path";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { UsersController } from "./controllers/UsersController.mjs";
import { LocationController } from "./controllers/LocationController.mjs";
import { AuthenticationController } from "./controllers/AuthenticationController.mjs";
import { BlogController } from "./controllers/BlogController.mjs";
import { BookingsController } from "./controllers/BookingsController.mjs";
import { SessionsController } from "./controllers/SessionsController.mjs";
import { ActivitiesController } from "./controllers/ActivitiesController.mjs";
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

const app = express();
const port = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(import.meta.dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit(limiterOptions);
app.use(cors(corsOptions));
app.use(limiter);
app.use(AuthenticationController.middleware);
app.use(sanitiser("warn"));
app.use(idempotencyMiddleware(devOptions));

console.log(logInfo, `Express-rate-limiter enabled.
                - Requests: ${limiterOptions.limit}
                - Period: ${limiterOptions.windowMs / 1000 / 60} minutes`);
console.log(logInfo, `Cors enabled, and allowing: ${corsOptions.origin}`);

app.use("/users", UsersController.routes);
app.use("/locations", LocationController.routes);
app.use("/blogs", BlogController.routes);
app.use("/bookings", BookingsController.routes);
app.use("/sessions", SessionsController.routes);
app.use("/activities", ActivitiesController.routes);
app.use("/authenticate", AuthenticationController.routes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.render("dashboard.ejs", {
    authenticatedUser: req.authenticatedUser,
    role: req.authenticatedUser?.role ?? "",
  });
});

app.use(express.static(path.join(import.meta.dirname, "public")));
app.use(express.static(path.join(import.meta.dirname, "dist")));
app.use(errorMiddleware());

app.listen(port, () => {
  console.log("Backend started on http://localhost:" + port);
});
