import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  getPollingConfig,
  getPollingState,
  getSyncHistory,
  manualFetchAll,
  manualFetchOne,
  restartPolling,
  stopPolling,
  updatePollingConfig,
} from "../controllers/ifs.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import { audit } from "../middleware/audit.middleware.js";
import {
  ifsFetchAllSchema,
  ifsFetchHistoryQuerySchema,
  ifsFetchOneParamSchema,
  ifsPollConfigUpdateSchema,
  ifsPollRestartSchema,
  ifsPollStopSchema,
} from "../schemas/ifs.schemas.js";

/**
 * @openapi
 * tags:
 *   - name: IFS Integration
 *     description: IFS read-only fetch/synchronization and automatic poll management
 */

const router = Router();

router.use(authenticate);
router.use(audit);

/**
 * @openapi
 * /ifs/fetch:
 *   post:
 *     summary: Manual fetch of all current IFS gate entries
 *     description: Synchronizes every gate entry currently in IFS. Uses the same idempotent synchronization service as the poller.
 *     tags: [IFS Integration]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Synchronization finished (per-gate-entry failures are listed)
 *       '503':
 *         description: IFS connection error
 */
router.post(
  "/fetch",
  requirePermission(PERMISSIONS.IFS_FETCH),
  validate(ifsFetchAllSchema, "body"),
  manualFetchAll,
);

/**
 * @openapi
 * /ifs/fetch/history:
 *   get:
 *     summary: Per gate-entry sync history
 *     description: Paginated list of SITS-side gate-entry sync outcomes (PENDING / SYNCED / FAILED) with last sync time and error description for the Integration Health UI.
 *     tags: [IFS Integration]
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
 *         schema: { type: string, enum: [PENDING, SYNCED, FAILED] }
 *     responses:
 *       '200':
 *         description: Sync history retrieved
 */
router.get(
  "/fetch/history",
  requirePermission(PERMISSIONS.IFS_FETCH),
  validate(ifsFetchHistoryQuerySchema, "query"),
  getSyncHistory,
);

/**
 * @openapi
 * /ifs/fetch/{gateEntryNo}:
 *   post:
 *     summary: Manual fetch of a single IFS gate entry
 *     description: Synchronizes one specific gate entry (GATE_ENTRY_NO) into SITS idempotently.
 *     tags: [IFS Integration]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: gateEntryNo
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Gate entry synchronized
 *       '422':
 *         description: Gate entry could not be synchronized
 *       '503':
 *         description: IFS connection error
 */
router.post(
  "/fetch/:gateEntryNo",
  requirePermission(PERMISSIONS.IFS_FETCH),
  validate(ifsFetchOneParamSchema, "params"),
  manualFetchOne,
);

/**
 * @openapi
 * /ifs/poll/config:
 *   get:
 *     summary: Read the IFS polling configuration
 *     description: Returns the admin-configurable polling policy (interval, failure ranges, stop threshold, batch size, fetch-ready QC status, notify roles).
 *     tags: [IFS Integration]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Polling configuration retrieved
 */
router.get("/poll/config", requirePermission(PERMISSIONS.IFS_POLL_CONFIG_READ), getPollingConfig);

/**
 * @openapi
 * /ifs/poll/config:
 *   put:
 *     summary: Update the IFS polling configuration
 *     description: Partially updates the polling policy at runtime — no code deployment required.
 *     tags: [IFS Integration]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *               normalIntervalMs: { type: integer, minimum: 1000 }
 *               stopThreshold: { type: integer, minimum: 1 }
 *               batchSize: { type: integer, minimum: 1, maximum: 1000 }
 *               fetchReadyQcStatus: { type: string }
 *               notifyAdminRoles: { type: array, items: { type: string } }
 *               failureRanges:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     min: { type: integer, minimum: 1 }
 *                     max: { type: integer, minimum: 1 }
 *                     intervalMs: { type: integer, minimum: 1000 }
 *                     notify: { type: boolean }
 *     responses:
 *       '200':
 *         description: Polling configuration updated
 *       '400':
 *         description: Validation error
 */
router.put(
  "/poll/config",
  requirePermission(PERMISSIONS.IFS_POLL_CONFIG_WRITE),
  validate(ifsPollConfigUpdateSchema, "body"),
  updatePollingConfig,
);

/**
 * @openapi
 * /ifs/poll/state:
 *   get:
 *     summary: Read the IFS polling state
 *     description: Returns persisted polling status, last success/failure, consecutive failure count, current interval and stop details.
 *     tags: [IFS Integration]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Polling state retrieved
 */
router.get("/poll/state", requirePermission(PERMISSIONS.IFS_POLL_STATE_READ), getPollingState);

/**
 * @openapi
 * /ifs/poll/restart:
 *   post:
 *     summary: Restart the IFS poller (Admin only)
 *     description: Reschedules the poll at the normal interval and clears the failure/stop state. Only an Admin can restart a stopped poller.
 *     tags: [IFS Integration]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Poller restarted
 */
router.post(
  "/poll/restart",
  requirePermission(PERMISSIONS.IFS_POLL_CONTROL),
  validate(ifsPollRestartSchema, "body"),
  restartPolling,
);

/**
 * @openapi
 * /ifs/poll/stop:
 *   post:
 *     summary: Stop the IFS poller
 *     description: Removes the scheduled poll. The poller stays stopped across restarts until an Admin restarts it.
 *     tags: [IFS Integration]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       '200':
 *         description: Poller stopped
 */
router.post(
  "/poll/stop",
  requirePermission(PERMISSIONS.IFS_POLL_CONTROL),
  validate(ifsPollStopSchema, "body"),
  stopPolling,
);

export default router;
