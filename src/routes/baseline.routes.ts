import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import { captureBaseline, getBaseline, listBaselines } from "../controllers/baseline.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import {
  captureBaselineSchema,
  listBaselinesQuerySchema,
  packetTagIdParamSchema,
} from "../schemas/baseline.schemas.js";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Baseline
 *     description: Phase 3 — Baseline Count (RF-13 → RF-20). Captures packet count via Manual, Weight, or Reel methods.
 */

/**
 * @openapi
 * /baseline/capture:
 *   post:
 *     summary: Capture baseline count for a packet
 *     description: >
 *       Main Phase 3 endpoint. Captures the baseline count using one of three methods
 *       (MANUAL, WEIGHT, REEL). Compares against IFS qty and flags variance if mismatch
 *       (flag & proceed per BR-06). Raises BASELINE_VARIANCE alert on variance (RF-19).
 *     tags: [Baseline]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packetTagId, method]
 *             properties:
 *               packetTagId: { type: string, example: "1" }
 *               method: { type: string, enum: [MANUAL, WEIGHT, REEL] }
 *               manualCount: { type: number, description: "Required for MANUAL method", example: 100 }
 *               unitWeight: { type: number, description: "Required for WEIGHT method (kg/unit)", example: 0.030 }
 *               totalWeight: { type: number, description: "Required for WEIGHT method (kg)", example: 3.0 }
 *               reelReading: { type: number, description: "Required for REEL method", example: 595 }
 *               deviceId: { type: string, example: "WM-TRANSIT-01" }
 *               notes: { type: string }
 *     responses:
 *       '201':
 *         description: Baseline captured
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 baseline: { type: object }
 *                 variance:
 *                   type: object
 *                   properties:
 *                     hasVariance: { type: boolean }
 *                     amount: { type: number }
 *                 alertRaised: { type: boolean }
 *       '400': { description: Validation error or packet not commissioned }
 *       '404': { description: Packet not found }
 *       '409': { description: Baseline already exists for this packet }
 */
router.post(
  "/capture",
  requirePermission(PERMISSIONS.BASELINE_CREATE),
  validate(captureBaselineSchema),
  audit,
  captureBaseline,
);

/**
 * @openapi
 * /baseline:
 *   get:
 *     summary: List baseline records
 *     description: Paginated list of baseline records with optional filters.
 *     tags: [Baseline]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: method
 *         schema: { type: string, enum: [MANUAL, WEIGHT, REEL] }
 *       - in: query
 *         name: varianceOnly
 *         schema: { type: boolean }
 *         description: If true, only returns baselines flagged with variance
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200': { description: Baselines retrieved }
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.BASELINE_READ),
  validate(listBaselinesQuerySchema, "query"),
  listBaselines,
);

/**
 * @openapi
 * /baseline/{packetTagId}:
 *   get:
 *     summary: Get baseline for a specific packet
 *     tags: [Baseline]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: packetTagId
 *         required: true
 *         schema: { type: string, example: "1" }
 *     responses:
 *       '200': { description: Baseline record }
 *       '404': { description: Baseline not found }
 */
router.get(
  "/:packetTagId",
  requirePermission(PERMISSIONS.BASELINE_READ),
  validate(packetTagIdParamSchema, "params"),
  getBaseline,
);

export default router;
