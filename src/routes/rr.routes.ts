import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  checkSerials,
  getRrById,
  getRrLineById,
  listRrLines,
  listRrs,
} from "../controllers/rr.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { validate } from "../middleware/http.middleware.js";
import {
  listRrLinesQuerySchema,
  listRrsSchema,
  rrIdParamSchema,
  rrLineIdParamSchema,
} from "../schemas/rr.schemas.js";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Receiving Reports
 *     description: Read-only mirror of IFS Receiving Report data
 */

/**
 * @openapi
 * /rrs:
 *   get:
 *     summary: List Receiving Reports
 *     description: Returns a paginated list of RRs with per-RR taggability summary.
 *     tags: [Receiving Reports]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       '200': { description: RRs retrieved successfully }
 */
router.get("/", requirePermission(PERMISSIONS.RR_READ), validate(listRrsSchema, "query"), listRrs);

/**
 * @openapi
 * /rrs/lines:
 *   get:
 *     summary: List RR lines (optionally filtered)
 *     description: Use `taggableOnly=true` to list only lines ready for tagging.
 *     tags: [Receiving Reports]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: rrId
 *         schema: { type: string }
 *       - in: query
 *         name: qcStatus
 *         schema: { type: string, enum: [passed, failed, pending] }
 *       - in: query
 *         name: taggableOnly
 *         schema: { type: boolean }
 *     responses:
 *       '200': { description: RR lines retrieved successfully }
 */
router.get(
  "/lines",
  requirePermission(PERMISSIONS.RR_READ),
  validate(listRrLinesQuerySchema, "query"),
  listRrLines,
);

// ── SPECIFIC SUB-ROUTES MUST COME BEFORE /:id ────────────────

/**
 * @openapi
 * /rrs/lines/{id}/serial-check:
 *   get:
 *     summary: Check if an RR line is ready for tagging (validates serials)
 *     description: Checks if IFS provided valid serial numbers for serialized items before allowing tagging to start.
 *     tags: [Receiving Reports]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "1" }
 *     responses:
 *       '200':
 *         description: Serial validation result returned
 */
router.get(
  "/lines/:id/serial-check",
  requirePermission(PERMISSIONS.RR_READ),
  validate(rrLineIdParamSchema, "params"),
  checkSerials,
);

/**
 * @openapi
 * /rrs/lines/{id}:
 *   get:
 *     summary: Get a single RR line by id
 *     tags: [Receiving Reports]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: RR line retrieved successfully }
 */
router.get(
  "/lines/:id",
  requirePermission(PERMISSIONS.RR_READ),
  validate(rrLineIdParamSchema, "params"),
  getRrLineById,
);

/**
 * @openapi
 * /rrs/{id}:
 *   get:
 *     summary: Get an RR with all its lines
 *     tags: [Receiving Reports]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200': { description: RR retrieved successfully }
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.RR_READ),
  validate(rrIdParamSchema, "params"),
  getRrById,
);

export default router;
