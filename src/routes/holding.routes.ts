import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  listPendingTransfers,
  receive,
  reconcileAlternate,
  scanArrival,
} from "../controllers/holding.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import {
  holdingReceiveSchema,
  holdingScanSchema,
  reconcileAlternateSchema,
} from "../schemas/holding.schemas.js";

const router = Router();
router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Holding Receive
 *     description: Phase 6 — Holding Receive & Alternate Item Reconciliation (RF-29 → RF-32)
 */

/**
 * @openapi
 * /holding/pending:
 *   get:
 *     summary: List pending transfers for Holding receive
 *     description: Returns all transfers currently in transit or partially received.
 *     tags: [Holding Receive]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Pending transfers list retrieved successfully
 */
router.get("/pending", requirePermission(PERMISSIONS.HOLDING_RECEIVE), listPendingTransfers);

/**
 * @openapi
 * /holding/scan:
 *   post:
 *     summary: Scan incoming trolley at Holding Entry (RF-29, RF-30)
 *     description: Reads arriving EPCs via 4-port reader, compares against Transfer ID set, and reports found, missing, or extra tags.
 *     tags: [Holding Receive]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId, transferId, scannedEpcs]
 *             properties:
 *               deviceId: { type: string, example: "FX-HOLDING-ENTRY-01" }
 *               transferId: { type: string, example: "TRF-2026-0001" }
 *               scannedEpcs:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["EPC-RR20260001-L001-P1", "EPC-RR20260001-L001-P2"]
 *     responses:
 *       '200':
 *         description: Trolley scan audit result
 */
router.post(
  "/scan",
  requirePermission(PERMISSIONS.HOLDING_SCAN),
  validate(holdingScanSchema),
  audit,
  scanArrival,
);

/**
 * @openapi
 * /holding/receive:
 *   post:
 *     summary: Receive transfer at Holding (Partial Accept - RF-30, RF-31)
 *     description: Confirms reception of packages. Supports partial acceptance and records missing items with package-level identity preservation. Raises shortfall alert if items missing.
 *     tags: [Holding Receive]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [transferId, receivedItems]
 *             properties:
 *               transferId: { type: string, example: "TRF-2026-0001" }
 *               receivedItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [epc]
 *                   properties:
 *                     epc: { type: string, example: "EPC-RR20260001-L001-P1" }
 *                     receivedQty: { type: number, example: 100 }
 *               notes: { type: string, example: "Verified at Holding door" }
 *     responses:
 *       '200':
 *         description: Transfer reception recorded
 */
router.post(
  "/receive",
  requirePermission(PERMISSIONS.HOLDING_RECEIVE),
  validate(holdingReceiveSchema),
  audit,
  receive,
);

/**
 * @openapi
 * /holding/reconcile-alternate:
 *   post:
 *     summary: Reconcile alternate item at Holding (X → Y - RF-32)
 *     description: Reconciles SITS-tagged alternate Y against IFS-updated item value while maintaining original item X link.
 *     tags: [Holding Receive]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packetTagId, ifsUpdatedItemCode]
 *             properties:
 *               packetTagId: { type: string, example: "1" }
 *               ifsUpdatedItemCode: { type: string, example: "ITEM-003" }
 *     responses:
 *       '200':
 *         description: Alternate item reconciled
 */
router.post(
  "/reconcile-alternate",
  requirePermission(PERMISSIONS.HOLDING_RECONCILE),
  validate(reconcileAlternateSchema),
  audit,
  reconcileAlternate,
);

export default router;
