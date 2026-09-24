import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import { transitExitController } from "../controllers/transit-exit.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import { audit } from "../middleware/audit.middleware.js";
import {
  transitExitAlertSchema,
  transitExitChargeCheckSchema,
  transitExitGenerateTransferSchema,
  transitExitSelectApprovedSchema,
} from "../schemas/transit-exit.schemas.js";

const router = Router();

/**
 * @swagger
 * /transit-exit/check-charge:
 *   post:
 *     tags: [TransitExit]
 *     summary: Check IFS charge approval for a set of EPCs (RF-22)
 *     description: >
 *       Given the EPC set captured at the transit exit (RF-21), resolves the
 *       IFS charge-approval status for each RR line the EPCs belong to. The
 *       result is consumed downstream by RF-23 (approved-subset selection).
 *
 *       Resolution is Redis-first (cache key `charge_status:{rrLineId}`, 5 min
 *       TTL); on a cache miss the LIVE approval status is read from the IFS
 *       `IFS_CHARGE_STATUS_VIEW` and cached. The PostgreSQL mirror
 *       (`rr_lines.charge_status`) is never used for the decision. If the source
 *       of truth is unavailable the line is placed on HOLD — approval is never
 *       assumed.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransitExitChargeCheckRequest'
 *     responses:
 *       200:
 *         description: Charge-approval check completed (per-line + per-EPC).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TransitExitChargeCheckResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/check-charge",
  authenticate,
  requirePermission(PERMISSIONS.TRANSIT_CHARGE_CHECK),
  validate(transitExitChargeCheckSchema),
  audit,
  transitExitController.checkCharge,
);

/**
 * @swagger
 * /transit-exit/select-approved:
 *   post:
 *     tags: [TransitExit]
 *     summary: Select the approved subset of EPCs for dispatch (RF-23)
 *     description: >
 *       Allows the authorized transit-exit operator to select the subset of
 *       captured EPCs that has been approved for dispatch. The system processes
 *       the submitted EPC set and returns the partition between approved EPCs
 *       and the remaining EPCs.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransitExitSelectApprovedRequest'
 *     responses:
 *       200:
 *         description: Approved and remaining EPCs partitioned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransitExitSelectApprovedResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/select-approved",
  authenticate,
  requirePermission(PERMISSIONS.TRANSIT_SELECT_APPROVED),
  validate(transitExitSelectApprovedSchema),
  audit,
  transitExitController.selectApproved,
);

/**
 * @swagger
 * /transit-exit/generate-transfer:
 *   post:
 *     tags: [TransitExit]
 *     summary: Generate Transfer ID for approved EPCs (RF-24)
 *     description: >
 *       Human/operator endpoint. Generates a unique Transfer ID (TID) for the
 *       approved EPC subset received from RF-23. Validates each EPC is approved
 *       (charge status re-resolved live: Redis → IFS → HOLD) and eligible for
 *       transfer, persists Transfer and TransferLine records in a transaction,
 *       creates Redis mappings (tid:{epc} → TID, tid_set:{tid} → EPC set,
 *       transfer:{tid} → gate-verification JSON), and logs the event.
 *
 *       The device-facing reader uses the same shared implementation via
 *       `POST /reader-lookup/generate-transfer`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransitExitGenerateTransferRequest'
 *     responses:
 *       201:
 *         description: Transfer ID generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TransitExitGenerateTransferResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/generate-transfer",
  authenticate,
  requirePermission(PERMISSIONS.TRANSIT_GENERATE_TRANSFER),
  validate(transitExitGenerateTransferSchema),
  audit,
  transitExitController.generateTransfer,
);

/**
 * @swagger
 * /transit-exit/alert:
 *   post:
 *     tags: [TransitExit]
 *     summary: Raise a not-approved alert at the transit exit (RF-25)
 *     description: >
 *       When the operator at the transit exit decides NOT to approve a packet
 *       (or a set of EPCs) for dispatch, they raise an alert addressed to the
 *       relevant managers (transit_manager, holding_manager). The alert is
 *       persisted in the generic `Alert` model and the recipients are resolved
 *       server-side from their roles — no recipient list is accepted from the
 *       client. The actual delivery channel is out of scope; this endpoint
 *       guarantees the alert is recorded and the correct recipients resolved.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransitExitAlertRequest'
 *     responses:
 *       201:
 *         description: Alert raised and recorded.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TransitExitAlertResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/alert",
  authenticate,
  requirePermission(PERMISSIONS.TRANSIT_ALERT_CREATE),
  validate(transitExitAlertSchema),
  audit,
  transitExitController.raiseAlert,
);

export default router;
