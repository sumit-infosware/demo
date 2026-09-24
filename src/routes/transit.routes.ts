import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import { readEpcs } from "../controllers/transit.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import { transitReadSchema } from "../schemas/transit.schemas.js";

const transitRouter = Router();

/**
 * @openapi
 * tags:
 *   - name: Transit
 *     description: Transit operations and RFID scanning sessions.
 */

/**
 * @openapi
 * /transit/read:
 *   post:
 *     summary: Record a bulk EPC read at the transit exit (RF-21)
 *     description: >
 *       Accepts a set of EPCs captured by an RFID reader at the transit exit.
 *       Each EPC is looked up in PacketTag. Registered EPCs are returned as FOUND;
 *       unregistered EPCs as UNKNOWN.
 *
 *       Completeness: when `transferId` is supplied, the expected set is the
 *       approved subset of that Transfer's lines — reads are compared against it
 *       (missing EPCs → requiresRescan). Without a transferId (e.g. the first raw
 *       read before a TID exists) no completeness claim is made and the raw read
 *       is returned (`complete: null`, `requiresRescan: false`).
 *     tags: [Transit]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransitReadRequest'
 *     responses:
 *       '200':
 *         description: Bulk read processed successfully
 *       '400':
 *         description: Bad Request
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 */
transitRouter.post(
  "/read",
  authenticate,
  requirePermission(PERMISSIONS.TAG_READ),
  validate(transitReadSchema),
  readEpcs,
);

export default transitRouter;
