import { Router } from "express";
import {
  getTransferExpectedTags,
  submitHoldingAudit,
  verifyTagAtGate,
} from "../controllers/gate-verify.controller.js";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Gate Verification
 *     description: Gate exit verify + Holding receive audit
 */

/**
 * @openapi
 * /gate/verify-tag:
 *   post:
 *     summary: Verify tag at fixed exit gate (ALLOW / ALARM)
 *     tags: [Gate Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [epc]
 *             properties:
 *               epc: { type: string }
 *               gateId: { type: string }
 *               direction: { type: string }
 *     responses:
 *       '200':
 *         description: ALLOW or ALARM
 */
router.post("/gate/verify-tag", verifyTagAtGate);

/**
 * @openapi
 * /transfer/{transferId}/expected:
 *   get:
 *     summary: Get expected EPCs for a Transfer ID
 *     tags: [Gate Verification]
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Expected tag list
 *       '404':
 *         description: Transfer not found
 */
router.get("/transfer/:transferId/expected", getTransferExpectedTags);

/**
 * @openapi
 * /transfer/{transferId}/receive:
 *   post:
 *     summary: Holding receive audit (FOUND / MISSING / EXTRA)
 *     tags: [Gate Verification]
 *     parameters:
 *       - in: path
 *         name: transferId
 *         required: true
 *         schema: { type: string, example: "TID-1788774217373" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scannedEpcs]
 *             properties:
 *               scannedEpcs:
 *                 type: array
 *                 items: { type: string }
 *               receivedBy:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Audit result with status update
 *       '404':
 *         description: Transfer not found
 */
router.post("/transfer/:transferId/receive", submitHoldingAudit);

export default router;
