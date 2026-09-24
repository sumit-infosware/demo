import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import { readEpcs } from "../controllers/transit-door.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import { transitDoorReadSchema } from "../schemas/transit-door.schemas.js";

const transitDoorRouter = Router();

/**
 * @swagger
 * /transit-door/read:
 *   post:
 *     summary: Read EPCs at transit door and verify TID (RF-26, RF-27, RF-28)
 *     description: >
 *       Gate reader at the transit door reads departing RFID tags.
 *       Each EPC is checked against Redis for a TID (key: tid:{epc}).
 *
 *       - TID exists → AUTHORIZED
 *       - Barcode-only tag (tagType BARCODE_ONLY) → EXEMPT (no TID expected, no alarm)
 *       - RFID-enabled tag with no TID → UNAUTHORIZED + CRITICAL alert (audience
 *         SECURITY,TRANSIT_MANAGER,HOLDING_MANAGER) + EventLog
 *
 *       Duplicate alarm prevention: checks for existing UNAUTHORIZED alert for the same EPC
 *       within a 5-minute window to avoid flooding from reader rescans.
 *
 *       Redis failure is treated as "no TID" (fail-open), consistent with transit-exit charge status.
 *     tags: [TransitDoor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransitDoorReadRequest'
 *     responses:
 *       200:
 *         description: Transit door read processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TransitDoorReadResponse'
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
transitDoorRouter.post(
  "/read",
  authenticate,
  requirePermission(PERMISSIONS.TRANSIT_DOOR_READ),
  validate(transitDoorReadSchema),
  readEpcs,
);

export default transitDoorRouter;
