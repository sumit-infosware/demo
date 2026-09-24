import { Router } from "express";
import {
  cancelRequest,
  createPhotoRequest,
  getRequestStatus,
  pendingRequests,
  submitPhoto,
} from "../controllers/handheld.controller.js";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Handheld
 *     description: >
 *       C72 / handheld camera bridge for Top Marking photos.
 *       Photos are captured BEFORE a tag exists — grouped by sessionId +
 *       packetIndex, then physically moved into the tag folder when
 *       POST /tags/generate is called with { photoRequestId }.
 */

/**
 * @openapi
 * /handheld/photo-request:
 *   post:
 *     summary: Frontend creates a new photo request (before tag exists)
 *     tags: [Handheld]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, totalPhotos]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: "sess-9-1789012345678"
 *                 description: Unique per tagging session (frontend picks it)
 *               packetIndex:
 *                 type: integer
 *                 example: 1
 *                 description: Which packet (1..N) these photos belong to
 *               rrLineId:
 *                 type: string
 *                 example: "9"
 *                 description: Optional — for context on handheld screen
 *               itemCode:
 *                 type: string
 *                 example: "NUT-M10-500"
 *                 description: Optional — for context on handheld screen
 *               totalPhotos:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 3
 *                 example: 2
 *     responses:
 *       '201':
 *         description: Request created; returns requestId to poll
 *       '400':
 *         description: Missing sessionId or totalPhotos
 */
router.post("/photo-request", createPhotoRequest);

/**
 * @openapi
 * /handheld/pending-requests:
 *   get:
 *     summary: Handheld polls this for pending capture requests
 *     tags: [Handheld]
 *     parameters:
 *       - in: query
 *         name: deviceId
 *         schema:
 *           type: string
 *           example: "C72-01"
 *     responses:
 *       '200':
 *         description: List of pending / in-progress requests
 */
router.get("/pending-requests", pendingRequests);

/**
 * @openapi
 * /handheld/request/{id}/status:
 *   get:
 *     summary: Frontend polls this to see progress + captured photos
 *     tags: [Handheld]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Current status with captured photos
 *       '404':
 *         description: Request not found (may have been cleaned up)
 */
router.get("/request/:id/status", getRequestStatus);

/**
 * @openapi
 * /handheld/submit-photo:
 *   post:
 *     summary: Handheld uploads one photo
 *     tags: [Handheld]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestId, sequence, photoBase64]
 *             properties:
 *               requestId:
 *                 type: string
 *                 example: "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
 *               sequence:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 3
 *                 example: 1
 *               photoBase64:
 *                 type: string
 *                 description: "data:image/jpeg;base64,... OR raw base64"
 *               deviceId:
 *                 type: string
 *                 example: "C72-01"
 *     responses:
 *       '200':
 *         description: Photo saved, request updated
 *       '400':
 *         description: Missing fields OR request already completed/cancelled
 *       '404':
 *         description: Request not found
 */
router.post("/submit-photo", submitPhoto);

/**
 * @openapi
 * /handheld/request/{id}/cancel:
 *   post:
 *     summary: Cancel a pending photo request
 *     tags: [Handheld]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Cancelled (or already gone)
 */
router.post("/request/:id/cancel", cancelRequest);

export default router;
