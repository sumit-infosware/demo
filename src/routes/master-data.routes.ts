import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  listApprovedAlternates,
  listLocationMaster,
  syncApprovedAlternates,
} from "../controllers/master-data.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import { audit } from "../middleware/audit.middleware.js";
import { syncApprovedAlternatesSchema } from "../schemas/master-data.schemas.js";

const router = Router();
router.use(authenticate);
router.use(audit);

/**
 * @openapi
 * tags:
 *   - name: Master Data
 *     description: Cached IFS master data available to SITS.
 * /master-data/approved-alternates:
 *   get:
 *     summary: List approved IFS item alternates
 *     tags: [Master Data]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: orderedItem
 *         schema: { type: string }
 *     responses:
 *       '200': { description: Cached approved alternates }
 * /master-data/locations:
 *   get:
 *     summary: List cached IFS bin-position mappings
 *     tags: [Master Data]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: binId
 *         schema: { type: string }
 *     responses:
 *       '200': { description: Cached IFS locations }
 * /master-data/approved-alternates/sync:
 *   post:
 *     summary: Full-sync approved IFS item alternates (RF-43)
 *     tags: [Master Data]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [orderedItem, alternateItem]
 *                   properties:
 *                     orderedItem: { type: string }
 *                     alternateItem: { type: string }
 *                     isApproved: { type: boolean }
 *     responses:
 *       '200': { description: Alternates sync counts }
 */
router.get("/approved-alternates", requirePermission(PERMISSIONS.TAG_READ), listApprovedAlternates);
router.post(
  "/approved-alternates/sync",
  requirePermission(PERMISSIONS.IFS_FETCH),
  validate(syncApprovedAlternatesSchema, "body"),
  syncApprovedAlternates,
);
router.get("/locations", requirePermission(PERMISSIONS.BINNING_LOCATION_READ), listLocationMaster);

export default router;
