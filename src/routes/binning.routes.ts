import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  activateBinningPlan,
  downloadPlanToDevice,
  findLocation,
  getBinningPlanByPlanId,
  getLatestBinningPlan,
  getLocationByTagId,
  getLocationForPlanLine,
  importBinningPlan,
  listBinningPlans,
  listLocations,
  placeAndVerify,
  registerLocation,
  syncRedock,
  unregisterLocation,
} from "../controllers/binning.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import { audit } from "../middleware/audit.middleware.js";
import {
  activatePlanParamSchema,
  binningPlanIdParamSchema,
  binningPlanQuerySchema,
  downloadPlanParamSchema,
  downloadPlanSchema,
  findLocationQuerySchema,
  getLatestPlanQuerySchema,
  importBinningPlanSchema,
  listLocationsQuerySchema,
  locationTagIdParamSchema,
  placeAndVerifySchema,
  planLineLocationParamSchema,
  registerLocationSchema,
  syncRedockSchema,
  unregisterLocationSchema,
} from "../schemas/binning.schemas.js";

const router = Router();

router.use(authenticate);
router.use(audit);

/**
 * @openapi
 * tags:
 *   - name: Binning
 *     description: Binning plan management and bin/position assignment operations
 */

/**
 * @openapi
 * /binning/plans:
 *   get:
 *     summary: List binning plans
 *     description: Returns a paginated list of binning plans with optional status filter.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, ACTIVE, ARCHIVED] }
 *     responses:
 *       '200':
 *         description: Binning plans retrieved successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 */
router.get(
  "/plans",
  requirePermission(PERMISSIONS.BINNING_PLAN_READ),
  validate(binningPlanQuerySchema, "query"),
  listBinningPlans,
);

/**
 * @openapi
 * /binning/plans/latest:
 *   get:
 *     summary: Get the latest active binning plan
 *     description: Returns the most recent ACTIVE binning plan. Useful when client doesn't know the specific plan ID.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Latest active binning plan retrieved successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: No active binning plan found
 */
router.get(
  "/plans/latest",
  requirePermission(PERMISSIONS.BINNING_PLAN_READ),
  validate(getLatestPlanQuerySchema, "query"),
  getLatestBinningPlan,
);

/**
 * @openapi
 * /binning/plans/{planId}:
 *   get:
 *     summary: Get a binning plan by IFS plan ID
 *     description: Returns the full binning plan with all lines including bin/position assignments for each item.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: string }
 *         description: IFS plan identifier (e.g., "BIN-2026-001")
 *     responses:
 *       '200':
 *         description: Binning plan retrieved successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: Binning plan not found
 */
router.get(
  "/plans/:planId",
  requirePermission(PERMISSIONS.BINNING_PLAN_READ),
  validate(binningPlanIdParamSchema, "params"),
  getBinningPlanByPlanId,
);

// ===== RF-37 (manual import): Plan Import/Activate Routes =====

/**
 * @openapi
 * /binning/plans/import:
 *   post:
 *     summary: Import a binning plan as final data (RF-37)
 *     description: Idempotently upserts a binning plan (DRAFT, source IMPORT) and its lines. Every binCode is validated against the storage hierarchy. Absent lines are removed.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId, lines]
 *             properties:
 *               planId:
 *                 type: string
 *                 example: "BIN-2026-001"
 *               version:
 *                 type: integer
 *                 minimum: 1
 *               notes:
 *                 type: string
 *               lines:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [itemCode, expectedQty, binCode]
 *                   properties:
 *                     lineNo:
 *                       type: integer
 *                     itemCode:
 *                       type: string
 *                     expectedQty:
 *                       type: number
 *                     binCode:
 *                       type: string
 *                       example: "BIN-001"
 *                     notes:
 *                       type: string
 *     responses:
 *       '201':
 *         description: Plan imported successfully
 *       '400':
 *         description: Unknown bin code(s) or validation error
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 */
router.post(
  "/plans/import",
  requirePermission(PERMISSIONS.IFS_FETCH),
  validate(importBinningPlanSchema, "body"),
  importBinningPlan,
);

/**
 * @openapi
 * /binning/plans/{planId}/activate:
 *   post:
 *     summary: Activate a binning plan (RF-37)
 *     description: Promotes a DRAFT binning plan to ACTIVE so handhelds can download it.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Plan activated successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: Plan not found
 *       '409':
 *         description: Plan is not in DRAFT status
 */
router.post(
  "/plans/:planId/activate",
  requirePermission(PERMISSIONS.BINNING_CONFIRM),
  validate(activatePlanParamSchema, "params"),
  activateBinningPlan,
);

// ===== RF-38: Plan Download Routes =====

/**
 * @openapi
 * /binning/plans/{planId}/download:
 *   post:
 *     summary: Download a binning plan to a handheld device
 *     description: Downloads an ACTIVE binning plan to a handheld device. Creates a download record and initializes sync state tracking.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId]
 *             properties:
 *               deviceId:
 *                 type: string
 *               expiresInHours:
 *                 type: integer
 *                 default: 24
 *                 minimum: 1
 *                 maximum: 168
 *     responses:
 *       '201':
 *         description: Plan downloaded successfully
 *       '404':
 *         description: Plan or device not found
 *       '409':
 *         description: Conflict - Plan not active, device not handheld, or already downloaded
 */
router.post(
  "/plans/:planId/download",
  requirePermission(PERMISSIONS.BINNING_PLAN_READ),
  validate(downloadPlanParamSchema, "params"),
  validate(downloadPlanSchema, "body"),
  downloadPlanToDevice,
);

// ===== RF-39: Find Location Routes =====

/**
 * @openapi
 * /binning/locations/find:
 *   get:
 *     summary: Find physical location by slot, RFID tag, or plan line (RF-39)
 *     description: Locates physical slot information (zone, aisle, shelf, level, RFID tag) for an operator using the MC33xR handheld.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: binId
 *         schema: { type: string }
 *         description: IFS Bin ID
 *       - in: query
 *         name: positionId
 *         schema: { type: string }
 *         description: IFS Position ID
 *       - in: query
 *         name: tagId
 *         schema: { type: string }
 *         description: Scanned Location RFID Tag ID
 *       - in: query
 *         name: planId
 *         schema: { type: string }
 *         description: IFS Binning Plan ID
 *       - in: query
 *         name: lineNo
 *         schema: { type: integer }
 *         description: Binning Plan Line Number
 *     responses:
 *       '200':
 *         description: Location mapping resolved successfully
 *       '400':
 *         description: Bad Request - Missing required lookup parameters
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: Location mapping or plan line not found
 */
router.get(
  "/locations/find",
  requirePermission(PERMISSIONS.BINNING_PLAN_READ),
  validate(findLocationQuerySchema, "query"),
  findLocation,
);

/**
 * @openapi
 * /binning/locations/{tagId}:
 *   get:
 *     summary: Get location mapping by RFID tag ID (RF-39)
 *     description: Resolves the physical slot and IFS Bin/Position mapped to a scanned RFID location tag.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema: { type: string }
 *         description: RFID Tag ID scanned by handheld
 *     responses:
 *       '200':
 *         description: Location mapping retrieved successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: Location mapping not found for tag
 */
router.get(
  "/locations/:tagId",
  requirePermission(PERMISSIONS.BINNING_PLAN_READ),
  validate(locationTagIdParamSchema, "params"),
  getLocationByTagId,
);

/**
 * @openapi
 * /binning/plans/{planId}/lines/{lineNo}/location:
 *   get:
 *     summary: Get location mapping for a specific plan line (RF-39)
 *     description: Resolves the physical slot guidance (zone, aisle, shelf, level, tagId) for a specific plan line.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: string }
 *         description: IFS Plan identifier
 *       - in: path
 *         name: lineNo
 *         required: true
 *         schema: { type: integer }
 *         description: Plan line number
 *     responses:
 *       '200':
 *         description: Plan line location details retrieved successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: Plan line or location mapping not found
 */
router.get(
  "/plans/:planId/lines/:lineNo/location",
  requirePermission(PERMISSIONS.BINNING_PLAN_READ),
  validate(planLineLocationParamSchema, "params"),
  getLocationForPlanLine,
);

// ===== RF-40: Place & Verify Routes =====

/**
 * @openapi
 * /binning/place-verify:
 *   post:
 *     summary: Verify and confirm packet placement in assigned slot (RF-40)
 *     description: Compares actual scanned location against the active binning plan. If matching, confirms placement and marks plan line as completed. If mismatched, returns warning and raises alert without confirming.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId]
 *             properties:
 *               packetEpc:
 *                 type: string
 *                 description: EPC of the packet to place
 *                 example: "urn:epc:id:sgtin:0614141.107346.2026"
 *               packetTagId:
 *                 type: string
 *                 description: ID of the packet tag
 *                 example: "1"
 *               locationTagId:
 *                 type: string
 *                 description: Scanned RFID location tag at shelf/slot
 *                 example: "LOC-TAG-001"
 *               binId:
 *                 type: string
 *                 description: Scanned or entered Bin ID
 *                 example: "BIN-A1"
 *               positionId:
 *                 type: string
 *                 description: Scanned or entered Position ID
 *                 example: "P-01"
 *               planId:
 *                 type: string
 *                 description: Optional specific plan ID (defaults to active plan)
 *                 example: "BIN-2026-001"
 *               deviceId:
 *                 type: string
 *                 description: MC33xR Handheld device identifier
 *                 example: "MC3300-01"
 *               isOffline:
 *                 type: boolean
 *                 description: Whether this confirmation occurred while offline
 *                 default: false
 *               confirmedAt:
 *                 type: string
 *                 format: date-time
 *                 description: Timestamp when confirmation was recorded on handheld
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *     responses:
 *       '200':
 *         description: Placement verification response (includes matched or mismatched status)
 *       '400':
 *         description: Bad Request - Missing required packet or location identifiers
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: Packet, plan assignment, or location mapping not found
 *       '409':
 *         description: Conflict - Inactive device or invalid device type
 */
router.post(
  "/place-verify",
  requirePermission(PERMISSIONS.BINNING_CONFIRM),
  validate(placeAndVerifySchema, "body"),
  placeAndVerify,
);

// ===== RF-42: Sync on Re-dock Routes =====

/**
 * @openapi
 * /binning/sync:
 *   post:
 *     summary: Bulk upload and synchronize offline placement confirmations on handheld re-dock (RF-42)
 *     description: Syncs offline placement confirmations collected by MC33xR device when it is re-docked. Performs bulk validation, conflict detection, updates plan lines and packet tags, logs sync logs and events.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId, confirmations]
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Handheld device identifier
 *                 example: "MC3300-01"
 *               planId:
 *                 type: string
 *                 description: Optional specific plan ID to sync against
 *                 example: "BIN-2026-001"
 *               planVersion:
 *                 type: integer
 *                 description: Optional plan version to sync against
 *                 example: 1
 *               confirmations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: []
 *                   properties:
 *                     packetEpc:
 *                       type: string
 *                       example: "urn:epc:id:sgtin:0614141.107346.2026"
 *                     packetTagId:
 *                       type: string
 *                       example: "1"
 *                     binId:
 *                       type: string
 *                       example: "BIN-A1"
 *                     positionId:
 *                       type: string
 *                       example: "P-01"
 *                     locationTagId:
 *                       type: string
 *                       example: "LOC-TAG-001"
 *                     confirmedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-08-25T10:30:00Z"
 *                     notes:
 *                       type: string
 *                       example: "Sync batch placement"
 *     responses:
 *       '200':
 *         description: Sync process finished. Return details of success, conflicts, and failures.
 *       '400':
 *         description: Bad Request - Validation error
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: Device registry or plan not found
 *       '409':
 *         description: Conflict - Inactive device registry or device type mismatch
 */
router.post(
  "/sync",
  requirePermission(PERMISSIONS.BINNING_CONFIRM),
  validate(syncRedockSchema, "body"),
  syncRedock,
);

// ===== RF-41: Location ↔ RFID Mapping Routes =====

/**
 * @openapi
 * /binning/locations:
 *   get:
 *     summary: List bins across the storage hierarchy (RF-41)
 *     description: Paginated list of hierarchy bins with optional filters (warehouse, binCode, rfid).
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: warehouse
 *         schema: { type: string }
 *       - in: query
 *         name: binCode
 *         schema: { type: string }
 *       - in: query
 *         name: rfid
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       '200':
 *         description: Locations retrieved successfully
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 */
router.get(
  "/locations",
  requirePermission(PERMISSIONS.BINNING_LOCATION_READ),
  validate(listLocationsQuerySchema, "query"),
  listLocations,
);

/**
 * @openapi
 * /binning/locations/register:
 *   post:
 *     summary: Bind an RFID tag to a hierarchical bin (RF-41)
 *     description: Sets the binRfid of the matching hierarchy bin. Fails with 409 if the tag is already bound elsewhere.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rfid, binCode]
 *             properties:
 *               rfid:
 *                 type: string
 *                 example: "E280-1160-0000-0001"
 *               binCode:
 *                 type: string
 *                 example: "BIN-001"
 *     responses:
 *       '201':
 *         description: Tag registered on bin
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: Unknown bin code
 *       '409':
 *         description: Tag already bound to another bin/tier
 */
router.post(
  "/locations/register",
  requirePermission(PERMISSIONS.BINNING_LOCATION_MANAGE),
  validate(registerLocationSchema, "body"),
  registerLocation,
);

/**
 * @openapi
 * /binning/locations/unregister:
 *   post:
 *     summary: Release an RFID tag from the hierarchy (RF-41)
 *     description: Resets the matching bin/tier to its code-derived placeholder tag.
 *     tags: [Binning]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rfid]
 *             properties:
 *               rfid:
 *                 type: string
 *                 example: "E280-1160-0000-0001"
 *     responses:
 *       '200':
 *         description: Tag unregistered
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - Missing required permission
 *       '404':
 *         description: Tag is not bound to any bin/tier
 */
router.post(
  "/locations/unregister",
  requirePermission(PERMISSIONS.BINNING_LOCATION_MANAGE),
  validate(unregisterLocationSchema, "body"),
  unregisterLocation,
);

export default router;
