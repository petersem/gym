// swagger.config.mjs
import swaggerJsdoc from "swagger-jsdoc";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "../package.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment values to variables
const PORT = process.env.PORT || 3000;

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Gym API",
      version: pkg.version,
      description: "API documentation for my Gym backend Node app",
    },
    servers: [{ url: "/" }, { url: `http://localhost:${PORT}` }],
  },
  apis: [path.join(__dirname, "routes/*.mjs")],
};

export const swaggerSpec = swaggerJsdoc(options);
