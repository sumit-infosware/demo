import { Router } from "express";
import * as ctrl from "../controllers/put-away.controller.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import { audit } from "../middleware/audit.middleware.js";
import { putAwaySyncSchema } from "../schemas/put-away.schemas.js";

const router = Router();

// Apply authentication to all routes in this router
router.use(authenticate);
router.use(audit);

/**
 * @openapi
 * tags:
 *   - name: Put Away
 *     description: Phase 9 — Handheld put-away and storage confirmation sync.
 */

/**
 * @openapi
 * /put-away/sync:
 *   post:
 *     summary: Sync handheld offline put-away data
 *     description: Receives an array of storage confirmations from the Handheld MC33xR device when it re-docks, updates tag status to STORED, and creates storage confirmation records.
 *     tags: [Put Away]
 *     security:
 *       - bearerAuth: []
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
 *                   required: [packetTagEpc, binRfidEpc]
 *                   properties:
 *                     packetTagEpc:
 *                       type: string
 *                       example: "EPC-GE1001-L001-P1"
 *                     binRfidEpc:
 *                       type: string
 *                       example: "BIN-EPC-001"
 *                     ifsLocationNo:
 *                       type: string
 *                       example: "H1-B01-R01-T01-BIN01"
 *                     warehouse:
 *                       type: string
 *                       example: "HOLDING_1"
 *                     binNo:
 *                       type: string
 *                       example: "BIN-01"
 *                     confirmedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-01-15T10:30:00Z"
 *     responses:
 *       '201':
 *         description: Put-away data synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     syncedCount:
 *                       type: integer
 *                       example: 1
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           epc: { type: string }
 *                           status: { type: string, example: "STORED" }
 *                           binRfidEpc: { type: string }
 *       '400':
 *         description: Validation error or invalid payload
 *       '401':
 *         description: Unauthorized - authentication token missing or invalid
 *       '403':
 *         description: Forbidden - insufficient permissions
 */
router.post(
  "/sync",
  requirePermission(PERMISSIONS.PUT_AWAY_SYNC),
  validate(putAwaySyncSchema),
  ctrl.sync,
);

export default router;
