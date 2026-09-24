import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  getStockVerificationRun,
  listStockVerificationRuns,
  runStockVerification,
  syncStockVerification,
} from "../controllers/stock-verification.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import { audit } from "../middleware/audit.middleware.js";
import {
  stockVerificationRunParamSchema,
  stockVerificationRunsQuerySchema,
  stockVerificationRunSchema,
  stockVerificationSyncSchema,
} from "../schemas/stock-verification.schemas.js";

/**
 * @openapi
 * tags:
 *   - name: Stock Verification
 *     description: Phase 10 — Physical stock verification vs IFS INVENTORY_STOCK mirror.
 */

const router = Router();

router.use(authenticate);
router.use(audit);

/**
 * @openapi
 * /ifs/stock-verification/sync:
 *   post:
 *     summary: Sync handheld stock-verification walk-through
 *     description: Receives the RFID location/packet reads captured by the handheld during a physical stock check. Reconciles each reported location against the IFS stock mirror and reports FOUND / NOT_FOUND / EXTRA per part/lot.
 *     tags: [Stock Verification]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId, items]
 *             properties:
 *               deviceId:
 *                 type: string
 *                 example: "HANDHELD-MC33XR-01"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [binRfidEpc, ifsLocationNo, scannedEpcs]
 *                   properties:
 *                     binRfidEpc:
 *                       type: string
 *                       example: "BIN-EPC-001"
 *                     ifsLocationNo:
 *                       type: string
 *                       example: "H1-B01-R01-T01-BIN01"
 *                     warehouse:
 *                       type: string
 *                     scannedEpcs:
 *                       type: array
 *                       items: { type: string }
 *                       example: ["EPC-GE1001-L001-P1"]
 *                     scannedAt:
 *                       type: string
 *                       format: date-time
 *                     offline:
 *                       type: boolean
 *     responses:
 *       '201':
 *         description: Stock-verification runs created
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '409':
 *         description: Device is not an active handheld
 */
router.post(
  "/stock-verification/sync",
  validate(stockVerificationSyncSchema, "body"),
  syncStockVerification,
);

/**
 * @openapi
 * /ifs/stock-verification/run:
 *   post:
 *     summary: Run a manual stock-verification for one location
 *     description: Reconciles one location's stored tags (from put-away confirmations) against the IFS stock mirror.
 *     tags: [Stock Verification]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [locationNo]
 *             properties:
 *               locationNo:
 *                 type: string
 *                 example: "H1-B01-R01-T01-BIN01"
 *     responses:
 *       '201':
 *         description: Verification run created
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - insufficient permissions
 */
router.post(
  "/stock-verification/run",
  requirePermission(PERMISSIONS.IFS_FETCH),
  validate(stockVerificationRunSchema, "body"),
  runStockVerification,
);

/**
 * @openapi
 * /ifs/stock-verification/runs:
 *   get:
 *     summary: List stock-verification runs
 *     description: Paginated history of DEVICE / MANUAL / SCHEDULED verification runs with outcome counts.
 *     tags: [Stock Verification]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: trigger
 *         schema: { type: string, enum: [DEVICE, MANUAL, SCHEDULED] }
 *       - in: query
 *         name: locationNo
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Runs retrieved
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - insufficient permissions
 */
router.get(
  "/stock-verification/runs",
  requirePermission(PERMISSIONS.IFS_FETCH),
  validate(stockVerificationRunsQuerySchema, "query"),
  listStockVerificationRuns,
);

/**
 * @openapi
 * /ifs/stock-verification/runs/{id}:
 *   get:
 *     summary: Get a stock-verification run
 *     description: Returns a verification run with its outcome lines.
 *     tags: [Stock Verification]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Run retrieved
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - insufficient permissions
 *       '404':
 *         description: Run not found
 */
router.get(
  "/stock-verification/runs/:id",
  requirePermission(PERMISSIONS.IFS_FETCH),
  validate(stockVerificationRunParamSchema, "params"),
  getStockVerificationRun,
);

export default router;
