import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  captureCountCheck,
  getCountCheck,
  listCountChecks,
} from "../controllers/count-check.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import {
  captureCountCheckSchema,
  listCountChecksQuerySchema,
} from "../schemas/count-check.schemas.js";
import { packetTagIdParamSchema } from "../schemas/baseline.schemas.js";

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Count Check
 *     description: Phase 7 — Holding Count-Check vs Transit Baseline (RF-33 → RF-36)
 */

/**
 * @openapi
 * /count-check/capture:
 *   post:
 *     summary: Capture Holding count-check (RF-33 → RF-36)
 *     description: Reads tag, pulls Transit baseline, re-counts using inherited method, checks tolerance (±1 for small items), and records variance.
 *     tags: [Count Check]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packetTagId]
 *             properties:
 *               packetTagId: { type: string, example: "1" }
 *               method: { type: string, enum: [MANUAL, WEIGHT, REEL] }
 *               manualCount: { type: number, example: 100 }
 *               unitWeight: { type: number, example: 0.030 }
 *               totalWeight: { type: number, example: 3.0 }
 *               reelReading: { type: number, example: 600 }
 *               deviceId: { type: string, example: "WM-HOLDING-01" }
 *               managerOverride: { type: boolean, default: false }
 *               overrideNotes: { type: string, example: "Approved by Holding Manager" }
 *     responses:
 *       '201':
 *         description: Count check recorded
 */
router.post(
  "/capture",
  requirePermission(PERMISSIONS.COUNTCHECK_CREATE),
  validate(captureCountCheckSchema),
  audit,
  captureCountCheck,
);

/**
 * @openapi
 * /count-check:
 *   get:
 *     summary: List count check records
 *     tags: [Count Check]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: mismatchesOnly
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       '200':
 *         description: Count checks list
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.COUNTCHECK_READ),
  validate(listCountChecksQuerySchema, "query"),
  listCountChecks,
);

/**
 * @openapi
 * /count-check/{packetTagId}:
 *   get:
 *     summary: Get count check by packet tag ID
 *     tags: [Count Check]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: packetTagId
 *         required: true
 *         schema: { type: string, example: "1" }
 *     responses:
 *       '200':
 *         description: Count check record
 */
router.get(
  "/:packetTagId",
  requirePermission(PERMISSIONS.COUNTCHECK_READ),
  validate(packetTagIdParamSchema, "params"),
  getCountCheck,
);

export default router;
