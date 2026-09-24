import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import { acknowledgeAlert, listAlerts } from "../controllers/alerts.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import { alertIdParamSchema, listAlertsQuerySchema } from "../schemas/alerts.schemas.js";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * tags:
 *   - name: Alerts
 *     description: In-app notification service (RF-45). Air-gapped — no external notifications (BR-18).
 */

/**
 * @openapi
 * /alerts:
 *   get:
 *     summary: List alerts
 *     description: Paginated list of alerts with optional filters by type, severity, status, and read status.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, example: "TRANSIT_DOOR_UNAUTHORIZED" }
 *         description: "Filter by alert type (e.g., TRANSIT_DOOR_UNAUTHORIZED, TRANSIT_EXIT_NOT_APPROVED, BASELINE_VARIANCE, COUNT_CHECK_VARIANCE, HOLDING_SHORTFALL, NOT_APPROVED_DISPATCH, ANTI_THEFT_ALARM)"
 *       - in: query
 *         name: status
 *         schema: { type: string, example: "OPEN" }
 *         description: "Filter by alert status (OPEN, ACKNOWLEDGED, RESOLVED)"
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [INFO, WARNING, CRITICAL] }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean }
 *         description: If true, only returns unacknowledged alerts
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       '200':
 *         description: Alerts retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alerts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       type: { type: string }
 *                       alertType: { type: string }
 *                       severity: { type: string }
 *                       message: { type: string }
 *                       status: { type: string }
 *                       recipientRoles: { type: array, items: { type: string } }
 *                       sourceFn: { type: string }
 *                       createdAt: { type: string, format: date-time }
 *                       acknowledgedAt: { type: string, format: date-time, nullable: true }
 *                       resolvedAt: { type: string, format: date-time, nullable: true }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 */
router.get(
  "/",
  requirePermission(PERMISSIONS.ALERT_READ),
  validate(listAlertsQuerySchema, "query"),
  listAlerts,
);

/**
 * @openapi
 * /alerts/{id}/acknowledge:
 *   patch:
 *     summary: Acknowledge an alert
 *     description: Marks an alert as acknowledged by the current user. Idempotent - if already acknowledged, returns the existing alert without changes.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "1" }
 *         description: Alert ID (numeric)
 *     responses:
 *       '200':
 *         description: Alert acknowledged (or already acknowledged)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     type:
 *                       type: string
 *                       example: "TRANSIT_DOOR_UNAUTHORIZED"
 *                     alertType:
 *                       type: string
 *                       example: "TRANSIT_DOOR_UNAUTHORIZED"
 *                     severity:
 *                       type: string
 *                       enum: [INFO, WARNING, CRITICAL]
 *                     message:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "OPEN"
 *                     recipientRoles:
 *                       type: array
 *                       items:
 *                         type: string
 *                     channel:
 *                       type: string
 *                       example: "in-app"
 *                     sourceFn:
 *                       type: string
 *                       nullable: true
 *                     ref:
 *                       type: string
 *                       nullable: true
 *                     meta:
 *                       type: object
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     acknowledgedBy:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *                     acknowledgedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     resolvedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       '400':
 *         description: Invalid alert ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       '401':
 *         description: Unauthenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       '403':
 *         description: Forbidden - missing alert:acknowledge permission
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       '404':
 *         description: Alert not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotFoundError'
 */
router.patch(
  "/:id/acknowledge",
  requirePermission(PERMISSIONS.ALERT_ACKNOWLEDGE),
  validate(alertIdParamSchema, "params"),
  audit,
  acknowledgeAlert,
);

export default router;
