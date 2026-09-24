import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import { listAuditLogsHandler } from "../controllers/audit.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";

const router = Router();

// All audit routes require an authenticated caller.
router.use(authenticate);

/**
 * @openapi
 * /audit/logs:
 *   get:
 *     summary: List audit logs
 *     description: Returns a paginated list of audit records. Supports filtering by actor, action, resource, resourceId, and a time range.
 *     tags:
 *       - Audit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: actorId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: actorEmail
 *         description: Substring match against the actor's email (stored in metadata) or first/last name
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         description: Case-insensitive substring match against the raw action code or its display label
 *         schema: { type: string }
 *       - in: query
 *         name: resource
 *         description: Case-insensitive substring match against the raw resource or its display label
 *         schema: { type: string }
 *       - in: query
 *         name: resourceId
 *         description: Case-insensitive substring match
 *         schema: { type: string }
 *       - in: query
 *         name: screen
 *         description: Substring match against the HTTP method + path, or against the screen label/code
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         description: Free-text search across action, resource, resourceId, screen, result, IP, user agent, and actor (name or email)
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       '200':
 *         description: List of audit logs retrieved successfully
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
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AuditLogEntry'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/logs", requirePermission(PERMISSIONS.ADMIN_ACCESS), listAuditLogsHandler);

export default router;
