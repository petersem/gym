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
      version: "v" + pkg.version,
      description:
        "JSON REST API for the High Street Gym Tafe assessment app.\n\n" +
        "Guests can read blogs. Only members and trainers can authenticate; administrators have no API access.\n\n" +
        "### Access by role\n" +
        "![API access by role for guests, members, trainers and administrators](/images/api-role-sitemap.svg)\n\n" +
        "### Getting started\n" +
        "1. POST your email (as `username`) and password to `/api/v1/authenticate`.\n" +
        "2. Copy the returned `key`, click **Authorize**, and paste it into the ApiKey field.\n" +
        "3. Try the endpoints allowed for your role. DELETE `/api/v1/authenticate` to log out.\n\n",
    },
    servers: [{ url: "/", description: "Current server" }],
    tags: [
      {
        name: "Authentication",
        description:
          "Members and trainers can log in and revoke their API keys. Administrators have no API access.",
      },
      {
        name: "Users",
        description:
          "Members and trainers can read and update their own profile.",
      },
      {
        name: "Sessions",
        description:
          "Member and trainer timetable browsing and trainers' own session cancellations. Session list and detail reads are not available.",
      },
      {
        name: "Bookings",
        description:
          "Members read, create and cancel their own bookings. Trainers can only read bookings for sessions assigned to them.",
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
