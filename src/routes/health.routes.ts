import { Router } from "express";
import { liveness, readiness } from "../controllers/health.controller.js";

export const healthRouter = Router();

/**
 * @openapi
 * /health/live:
 *   get:
 *     summary: Liveness check
 *     description: Returns the liveness status of the service. Used by orchestration systems to determine if the process is alive.
 *     tags:
 *       - Health
 *     responses:
 *       '200':
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
healthRouter.get("/health/live", liveness);

/**
 * @openapi
 * /health/ready:
 *   get:
 *     summary: Readiness check
 *     description: Returns the readiness status of the service. Used by orchestration systems to determine if the service can handle requests.
 *     tags:
 *       - Health
 *     responses:
 *       '200':
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       '503':
 *         $ref: '#/components/responses/ServiceUnavailable'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
healthRouter.get("/health/ready", readiness);
