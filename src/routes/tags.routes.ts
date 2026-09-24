import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  attachTopMarkingPhoto,
  commissionTag,
  generateTag,
  getAvailableColours,
  getLabel,
  getTagById,
  getTagsByLine,
  listTags,
  startTagging,
  voidTagAndReprint,
} from "../controllers/tags.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import {
  commissionTagSchema,
  generateTagSchema,
  listTagsQuerySchema,
  startTaggingSchema,
  tagIdParamSchema,
  tagLookupParamSchema,
  uploadPhotoSchema,
  voidTagSchema,
} from "../schemas/tags.schemas.js";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Tags
 *     description: Packet tagging module (Phase 2) including v2.0 enhancements
 */

// ── Specific routes (before /:id) ─────────────────────────────

/**
 * @openapi
 * /tags/available-colours:
 *   get:
 *     summary: Get available colours for manual selection
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200': { description: Colour list retrieved successfully }
 */
router.get("/available-colours", requirePermission(PERMISSIONS.TAG_READ), getAvailableColours);

/**
 * @openapi
 * /tags/generate:
 *   post:
 *     summary: Generate a new tag (v2.0)
 *     description: >
 *       Creates a packet tag. If **photoRequestId** is provided, captured
 *       top-marking photos are automatically moved from
 *       `uploads/sessions/{sessionId}/` → `uploads/tags/{newTagId}/` and
 *       linked on the tag's `cocDocLink` JSON.
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rrLineId, packetIndex, totalPackets, packetQty, colour]
 *             properties:
 *               rrLineId: { type: string, example: "9" }
 *               packetIndex: { type: integer, example: 1 }
 *               totalPackets: { type: integer, example: 5 }
 *               packetQty: { type: number, example: 100 }
 *               colour: { type: string, example: "RED+BLUE" }
 *               serialNumber: { type: string, example: "SN001" }
 *               tagType:
 *                 type: string
 *                 enum: [LABEL, HARD, BARCODE]
 *                 example: LABEL
 *               photoRequestId:
 *                 type: string
 *                 description: >
 *                   Optional. If top-marking photos were captured before
 *                   generating this tag, pass the requestId returned from
 *                   POST /handheld/photo-request here.
 *                 example: "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
 *     responses:
 *       '201': { description: Tag generated successfully }
 *       '409': { description: Packet already tagged for this line }
 */
router.post(
  "/generate",
  requirePermission(PERMISSIONS.TAG_CREATE),
  validate(generateTagSchema),
  audit,
  generateTag,
);

/**
 * @openapi
 * /tags/start:
 *   post:
 *     summary: Start a bulk tagging session (v1 legacy)
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  "/start",
  requirePermission(PERMISSIONS.TAG_CREATE),
  validate(startTaggingSchema),
  audit,
  startTagging,
);

/**
 * @openapi
 * /tags:
 *   get:
 *     summary: List packet tags (paginated, filterable)
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.TAG_READ),
  validate(listTagsQuerySchema, "query"),
  listTags,
);

/**
 * @openapi
 * /tags/line/{rrLineId}:
 *   get:
 *     summary: List all tags for an RR line
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/line/:rrLineId", requirePermission(PERMISSIONS.TAG_READ), getTagsByLine);

// ── Parametric sub-routes ─────────────────────────────────────

/**
 * @openapi
 * /tags/{id}/photo:
 *   post:
 *     summary: Attach Top Marking photo — legacy single-photo path
 *     description: >
 *       Deprecated for the C72 flow — use the /handheld/* endpoints instead,
 *       which capture photos BEFORE the tag is generated and attach them
 *       automatically via `photoRequestId` on POST /tags/generate.
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "12" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [photoUrl]
 *             properties:
 *               photoUrl:
 *                 type: string
 *                 example: "data:image/jpeg;base64,/9j/4AAQ..."
 *               topNumber: { type: string, example: "TOP-A1" }
 *     responses:
 *       '200': { description: Photo attached }
 *       '404': { description: Tag not found }
 */
router.post(
  "/:id/photo",
  requirePermission(PERMISSIONS.HANDHELD_PHOTO_UPLOAD ?? PERMISSIONS.TAG_CREATE),
  validate(tagIdParamSchema, "params"),
  validate(uploadPhotoSchema),
  audit,
  attachTopMarkingPhoto,
);

/**
 * @openapi
 * /tags/{id}/void:
 *   post:
 *     summary: Void a tag and reprint (v2.0)
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  "/:id/void",
  requirePermission(PERMISSIONS.TAG_CREATE),
  validate(tagIdParamSchema, "params"),
  validate(voidTagSchema),
  audit,
  voidTagAndReprint,
);

/**
 * @openapi
 * /tags/{id}/label:
 *   get:
 *     summary: Get the printable label payload for a tag (RF-09)
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  "/:id/label",
  requirePermission(PERMISSIONS.TAG_PRINT),
  validate(tagIdParamSchema, "params"),
  audit,
  getLabel,
);

/**
 * @openapi
 * /tags/{id}/commission:
 *   post:
 *     summary: Commission a tag via read-back (RF-10)
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  "/:id/commission",
  requirePermission(PERMISSIONS.TAG_COMMISSION),
  validate(tagIdParamSchema, "params"),
  validate(commissionTagSchema),
  audit,
  commissionTag,
);

/**
 * @openapi
 * /tags/{id}:
 *   get:
 *     summary: Get a single tag by numeric id or RFID EPC
 *     tags: [Tags]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: "Tag numeric id (e.g. 123) or an RFID EPC (e.g. E200234342344)"
 *     responses:
 *       '200':
 *         description: Tag details retrieved
 *       '404':
 *         description: Tag not found
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.TAG_READ),
  validate(tagLookupParamSchema, "params"),
  getTagById,
);

export default router;
