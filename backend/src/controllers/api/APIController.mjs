import express from "express";
import swaggerUI from "swagger-ui-express";
import * as ApiValidator from "express-openapi-validator";
import { swaggerSpec } from "../../swagger.config.mjs";
import { APIUserController } from "./APIUserController.mjs";
import { APIAuthenticationController } from "./APIAuthenticationController.mjs";
import { APIResourcesController } from "./APIResourcesController.mjs";
import { apiErrorHandler } from "./apiHelpers.mjs";

export class APIController {
  static routes = express.Router();

  static {
    /**
     * @openapi
     * /api/v1/docs:
     *   get:
     *     tags: [Documentation]
     *     summary: View interactive API documentation
     *     responses:
     *       '200':
     *         description: Swagger UI HTML page.
     *         content:
     *           text/html:
     *             schema:
     *               type: string
     * /api/v1/openapi.json:
     *   get:
     *     tags: [Documentation]
     *     summary: Download the OpenAPI specification
     *     responses:
     *       '200':
     *         description: OpenAPI 3 specification.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     */
    this.routes.use(
      "/docs",
      swaggerUI.serve,
      swaggerUI.setup(swaggerSpec, {
        customCssUrl: "/css/swagger.css",
        customSiteTitle: "HSG App API",
        swaggerOptions: { displayRequestDuration: true },
      }),
    );
    this.routes.get("/openapi.json", (_req, res) => res.json(swaggerSpec));
    this.routes.use(express.json());
    this.routes.use(APIAuthenticationController.middleware);
    this.routes.use(
      ApiValidator.middleware({
        apiSpec: swaggerSpec,
        validateRequests: {
          coerceTypes: false,
          removeAdditional: false,
        },
        validateResponses: true,
        validateSecurity: false,
      }),
    );
    this.routes.use(APIAuthenticationController.routes);
    this.routes.use("/user", APIUserController.routes);
    this.routes.use(APIResourcesController.routes);
    this.routes.use((_req, res) =>
      res.status(404).json({ message: "API endpoint not found." }),
    );
    this.routes.use(apiErrorHandler);
  }
}
