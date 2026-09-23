import express from "express";
import path from "path";
// import { ProductController } from "./controllers/ProductController.mjs";
// import { OrderController } from "./controllers/OrderController.mjs";
// import { EmployeeController } from "./controllers/EmployeeController.mjs";
// import { AuthenticationController } from "./controllers/AuthenticationController.mjs";
// import { APIController } from "./controllers/api/APIController.mjs";
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { sanitiser, errorMiddleware, idempotencyMiddleware, devOptions, limiterOptions, rateLimit, corsOptions, swaggerSpec, fileURLToPath } from './middleware/middlewareLoader.mjs';
import { logDanger, logWarning, logInfo } from "./utilities/logger.mjs";
import { LocationModel } from "./models/LocationModel.mjs";


const app = express();
const port = 3000;

//TODO: enable the session middleware

app.set("view engine", "ejs");
app.set("views", path.join(import.meta.dirname, "views"));

app.use(express.json());
//Content-Type: application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
// app.use(AuthenticationController.middleware);

//TODO: Use routes (from controllers)
// app.use("/products", ProductController.routes);
// app.use("/orders", OrderController.routes);
// app.use("/employee", EmployeeController.routes);
// app.use("/authenticate", AuthenticationController.routes);
// app.use("/api", APIController.routes);
app.get("/", (req, res) => {
  res.status(301).redirect("/products");
});

app.use(express.static(path.join(import.meta.dirname, "public")));
app.use(express.static(path.join(import.meta.dirname, "dist")));

// implement express rate limiter
const limiter = rateLimit(limiterOptions)
app.use(limiter) // Apply the rate limiting middleware to all requests.
console.log(logInfo, `Express-rate-limiter enabled. 
                - Requests: ${limiterOptions.limit} 
                - Period: ${limiterOptions.windowMs / 1000 / 60} minutes`);

// add cors support
app.use(cors(corsOptions));
console.log(logInfo, `Cors enabled, and allowing: ${corsOptions.origin}`);

// add swagger docs
const __filename = fileURLToPath(import.meta.url);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
console.log(logInfo, `Swagger enabled on /api-docs`);

// must run before before routes and idemponcyMiddleware
app.use(sanitiser("reject")); // sanitises req.body prop values - Options are 'clean' (default), 'warn', 'fail', or 'disable'

// must run before routes
app.use(idempotencyMiddleware(devOptions)); // adds idempotence functionality for post, put, and patch - (flushes tokens as required)



app.listen(port, () => {
  console.log("Backend started on http://localhost:" + port);
});

