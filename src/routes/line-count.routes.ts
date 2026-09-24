import { Router } from "express";
import * as ctrl from "../controllers/line-count.controller.js";
import { PERMISSIONS } from "../constants/permissions.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import { audit } from "../middleware/audit.middleware.js";
import { captureLineCountSchema, rrLineIdParamSchema } from "../schemas/line-count.schemas.js";

const router = Router();

// Apply authentication to all routes in this router
router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Line Count
 *     description: Line-level counting before tagging (Phase 2). Supports Manual, Weight, and Reel methods.
 */

/**
 * @openapi
 * /line-count/capture:
 *   post:
 *     summary: Capture a line count
 *     description: Captures the total count for an RR Line before tagging. Calculates variance against IFS Challan Qty and raises alerts if necessary.
 *     tags: [Line Count]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rrLineId, method, numPackages, qtyPerPackage]
 *             properties:
 *               rrLineId:
 *                 type: string
 *                 example: "1"
 *               method:
 *                 type: string
 *                 enum: [MANUAL, WEIGHT, REEL]
 *                 example: "WEIGHT"
 *               numPackages:
 *                 type: integer
 *                 example: 5
 *               qtyPerPackage:
 *                 type: number
 *                 example: 100
 *               manualCount:
 *                 type: number
 *                 description: Required if method is MANUAL
 *               unitWeightG:
 *                 type: number
 *                 description: Required if method is WEIGHT
 *                 example: 3.5
 *               totalWeightG:
 *                 type: number
 *                 description: Required if method is WEIGHT
 *                 example: 1750
 *               reelReadingMtr:
 *                 type: number
 *                 description: Required if method is REEL
 *               pitchMm:
 *                 type: number
 *               operatorEditedQty:
 *                 type: number
 *                 description: Optional override by operator
 *               deviceId:
 *                 type: string
 *                 example: "WM-TRANSIT-01"
 *               notes:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Line count successfully captured
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     lineCount:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         finalCountedQty: { type: number }
 *                         varianceFlag: { type: boolean }
 *                     variance:
 *                       type: object
 *                       properties:
 *                         hasVariance: { type: boolean }
 *                         amount: { type: number }
 *                     alertRaised: { type: boolean }
 *                     canProceedToTagging: { type: boolean, example: true }
 *       '400':
 *         description: Validation error or missing required method fields
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 */
router.post(
  "/capture",
  requirePermission(PERMISSIONS.LINE_COUNT_CREATE),
  validate(captureLineCountSchema),
  audit,
  ctrl.captureLineCount,
);

/**
 * @openapi
 * /line-count/line/{rrLineId}/latest:
 *   get:
 *     summary: Get latest line count
 *     description: Retrieves the most recent line count record for a specific RR Line.
 *     tags: [Line Count]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rrLineId
 *         required: true
 *         schema: { type: string, example: "1" }
 *         description: RR Line ID (numeric string)
 *     responses:
 *       '200':
 *         description: Latest line count retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   nullable: true
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: RR Line or count not found
 */
router.get(
  "/line/:rrLineId/latest",
  requirePermission(PERMISSIONS.LINE_COUNT_READ),
  validate(rrLineIdParamSchema, "params"),
  ctrl.getLatestLineCount,
);

/**
 * @openapi
 * /line-count/line/{rrLineId}:
 *   get:
 *     summary: List all line counts for an RR Line
 *     description: Retrieves the history of all line count attempts for a specific RR Line.
 *     tags: [Line Count]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rrLineId
 *         required: true
 *         schema: { type: string, example: "1" }
 *         description: RR Line ID (numeric string)
 *     responses:
 *       '200':
 *         description: List of line counts retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rrLineId: { type: string }
 *                     total: { type: integer }
 *                     counts:
 *                       type: array
 *                       items:
 *                         type: object
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: RR Line not found
 */
router.get(
  "/line/:rrLineId",
  requirePermission(PERMISSIONS.LINE_COUNT_READ),
  validate(rrLineIdParamSchema, "params"),
  ctrl.listLineCountsByLine,
);

export default router;
