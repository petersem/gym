// swagger.config.mjs
import swaggerJsdoc from "swagger-jsdoc";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "../package.json" with { type: "json" };
import { apiResourcePaths } from "./controllers/api/APIResourcesController.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const options = {
  failOnErrors: true,
  definition: {
    openapi: "3.0.0",
    info: {
      title: "HSG App API",
      version: pkg.version,
      description:
        "JSON REST API for the High Street Gym Tafe assessment app.\n\n" +
        "### Getting started\n" +
        "1. POST your email (as `username`) and password to `/api/v1/authenticate`.\n" +
        "2. Copy the returned `key`, click **Authorize**, and paste it into the ApiKey field.\n" +
        "3. Try the endpoints allowed for your role. DELETE `/api/v1/authenticate` to log out.\n\n",
    },
    servers: [{ url: "/", description: "Current server" }],
    tags: [
      {
        name: "Authentication",
        description: "Log in with an existing gym account and revoke API keys.",
      },
      {
        name: "Users",
        description: "Admin user management and your current profile.",
      },
      {
        name: "Activities",
        description: "Admin management of gym activity types.",
      },
      {
        name: "Locations",
        description:
          "Admin management of gym locations and their contact details.",
      },
      {
        name: "Sessions",
        description: "Staff session management and the public timetable.",
      },
      {
        name: "Bookings",
        description: "Admin booking management and members' own bookings.",
      },
      {
        name: "Blogs",
        description: "Public gym news and authenticated authoring.",
      },
      {
        name: "Documentation",
        description:
          "Interactive documentation and downloadable OpenAPI specification.",
      },
    ],
    components: {
      securitySchemes: {
        ApiKey: {
          type: "apiKey",
          in: "header",
          name: "x-auth-key",
          description: "The key returned by POST /api/v1/authenticate.",
        },
      },
    },
    paths: apiResourcePaths,
  },
  apis: [
    path.join(__dirname, "controllers/api/*.mjs"),
    path.join(__dirname, "../components.yaml"),
  ].map((filePath) =>
    path.relative(process.cwd(), filePath).split(path.sep).join("/"),
  ),
};

export const swaggerSpec = swaggerJsdoc(options);
