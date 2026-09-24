import type { RequestHandler } from "express";
import { Router } from "express";
import {
  lookupSiblingTags,
  lookupTagByEpc,
  listActiveTags,
} from "../controllers/reader-lookup.controller.js";
import { transitExitController } from "../controllers/transit-exit.controller.js";
import { authenticateDevice } from "../middleware/device-auth.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import { transitExitGenerateTransferSchema } from "../schemas/transit-exit.schemas.js";

const router = Router();

const readerGenerateTransfer: RequestHandler = (req, res, next) => {
  void transitExitController.generateTransfer(req, res).catch((err: unknown) => next(err));
};

/**
 * Reader-service (C#) calls these on LAN.
 * Lookup routes are intentionally mounted WITHOUT JWT auth (device-facing).
 * Mutations are secured by `authenticateDevice` which validates the calling
 * reader against the registered DeviceRegistry.
 */

// ─── Generic lookups (device-facing, intentionally auth-free) ──
router.get("/tag/:epc", lookupTagByEpc);
router.get("/gate-entry/:gateEntryNo/tags", lookupSiblingTags);
router.get("/active-tags", listActiveTags);

/**
 * @openapi
 * /reader-lookup/generate-transfer:
 *   post:
 *     summary: Generate a transfer for approved EPCs from a registered reader (RF-24)
 *     description: >
 *       Device-authenticated substitute for the removed `/reader-lookup/create-transfer`
 *       and `/transit/create-transfer` duplicates. Authenticates the reader via the
 *       `X-Device-Id` header, then delegates to the SAME shared implementation as the
 *       human `/transit-exit/generate-transfer` endpoint — charge status is re-resolved
 *       live (Redis → IFS → HOLD), tags move to SENT_TO_HOLDING, and Redis mapping
 *       (tid:{epc}, tid_set:{tid}, transfer:{tid}) is created for gate verification.
 *     tags: [ReaderLookup]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Device-Id
 *         required: true
 *         schema:
 *           type: string
 *         example: "READER-4PORT-EXIT"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransitExitGenerateTransferRequest'
 *     responses:
 *       '201':
 *         description: Transfer generated successfully.
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
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  "/generate-transfer",
  authenticateDevice(["FOUR_PORT_READER"]),
  validate(transitExitGenerateTransferSchema),
  readerGenerateTransfer,
);

export default router;
