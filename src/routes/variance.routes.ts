import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import { getVariance, listVariances, resolveVariance } from "../controllers/variance.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import {
  listVariancesQuerySchema,
  resolveVarianceSchema,
  varianceIdParamSchema,
} from "../schemas/variance.schemas.js";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Variances
 *     description: Shared variance module (Phase 3, 6, 7). Records and resolves quantity mismatches with disposition workflow.
 */

/**
 * @openapi
 * /variances:
 *   get:
 *     summary: List variances
 *     description: Paginated list of variance records across all phases (baseline, count check, holding receive).
 *     tags: [Variances]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: context
 *         schema: { type: string, enum: [BASELINE, COUNT_CHECK, HOLDING_RECEIVE] }
 *       - in: query
 *         name: disposition
 *         schema: { type: string, enum: [PENDING, ACCEPTED, REJECTED, REWORK] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200':
 *         description: Variances retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 variances:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       context: { type: string }
 *                       ref: { type: string }
 *                       expectedQty: { type: number }
 *                       actualQty: { type: number }
 *                       varianceAmount: { type: number }
 *                       disposition: { type: string }
 *                       raisedAt: { type: string, format: date-time }
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.VARIANCE_READ),
  validate(listVariancesQuerySchema, "query"),
  listVariances,
);

/**
 * @openapi
 * /variances/{id}/resolve:
 *   patch:
 *     summary: Resolve a variance
 *     description: Manager sets disposition on a pending variance (ACCEPTED, REJECTED, or REWORK).
 *     tags: [Variances]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "1" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [disposition]
 *             properties:
 *               disposition: { type: string, enum: [ACCEPTED, REJECTED, REWORK] }
 *               notes: { type: string, example: "Vendor short-supplied; verified with GRN" }
 *     responses:
 *       '200': { description: Variance resolved }
 *       '404': { description: Variance not found }
 *       '409': { description: Variance already resolved }
 */
router.patch(
  "/:id/resolve",
  requirePermission(PERMISSIONS.VARIANCE_RESOLVE),
  validate(varianceIdParamSchema, "params"),
  validate(resolveVarianceSchema),
  audit,
  resolveVariance,
);

/**
 * @openapi
 * /variances/{id}:
 *   get:
 *     summary: Get variance by ID
 *     tags: [Variances]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "1" }
 *     responses:
 *       '200': { description: Variance details }
 *       '404': { description: Variance not found }
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.VARIANCE_READ),
  validate(varianceIdParamSchema, "params"),
  getVariance,
);

export default router;
