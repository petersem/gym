import express from "express";
import { DatabaseModel } from "../../models/DatabaseModel.mjs";

/**
 * Registers the API health check endpoint.
 */
export class APIHealthController {
  static routes = express.Router();

  static {
    this.routes.get("/health", this.getHealth);
  }

  /**
   * Report whether the API can reach its database. Connection failures are
   * passed to the API error handler, which responds with 503.
   *
   * @type {express.RequestHandler}
   * @openapi
   * /api/v1/health:
   *   get:
   *     tags: [Documentation]
   *     operationId: getHealth
   *     summary: Check that the API and database are available
   *     description: Public check for monitoring. Returns 200 when the database responds and 503 when it cannot be reached.
   *     security: []
   *     responses:
   *       '200':
   *         description: The API and database are available.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               required: [status]
   *               properties:
   *                 status:
   *                   type: string
   *                   enum: [ok]
   *       '500':
   *         $ref: "#/components/responses/InternalServerError"
   *       '503':
   *         $ref: "#/components/responses/ServiceUnavailable"
   */
  static async getHealth(req, res) {
    await DatabaseModel.query("SELECT 1");
    res.json({ status: "ok" });
  }
}
