import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  assignRoleHandler,
  createPermissionHandler,
  createRoleHandler,
  deletePermissionHandler,
  deleteRoleHandler,
  getMyPermissionsHandler,
  getPermissionHandler,
  getRoleHandler,
  listPermissionsHandler,
  listRolesHandler,
  updatePermissionHandler,
  updateRoleHandler,
} from "../controllers/rbac.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import {
  createPermissionSchema,
  createRoleSchema,
  idParamSchema,
  updatePermissionSchema,
  updateRoleSchema,
} from "../schemas/rbac.schemas.js";

const router = Router();

// All RBAC routes require an authenticated caller.
router.use(authenticate);

/**
 * @openapi
 * /rbac/roles:
 *   get:
 *     summary: List all roles
 *     description: Returns every role in the system together with the permissions granted by each role.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RoleListResponse'
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
router.get("/roles", requirePermission(PERMISSIONS.ROLE_READ), listRolesHandler);

/**
 * @openapi
 * /rbac/roles:
 *   post:
 *     summary: Create a role
 *     description: Creates a new role and optionally assigns permissions to it.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleCreateRequest'
 *     responses:
 *       '201':
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RoleResponse'
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/roles",
  requirePermission(PERMISSIONS.ROLE_CREATE),
  validate(createRoleSchema),
  audit,
  createRoleHandler,
);

/**
 * @openapi
 * /rbac/roles/{id}:
 *   get:
 *     summary: Get a role by id
 *     description: Returns a single role with its assigned permissions.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Role retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RoleResponse'
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLE_READ),
  validate(idParamSchema, "params"),
  getRoleHandler,
);

/**
 * @openapi
 * /rbac/roles/{id}:
 *   patch:
 *     summary: Update a role
 *     description: >
 *       Updates a role's name/description and, when `permissionIds` is supplied,
 *       fully replaces the role's permission set with the provided ids.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleUpdateRequest'
 *     responses:
 *       '200':
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RoleResponse'
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLE_UPDATE),
  validate(idParamSchema, "params"),
  validate(updateRoleSchema),
  audit,
  updateRoleHandler,
);

/**
 * @openapi
 * /rbac/roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     description: Deletes a role. System roles cannot be deleted.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Role deleted successfully
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
 *                       format: uuid
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/roles/:id",
  requirePermission(PERMISSIONS.ROLE_DELETE),
  validate(idParamSchema, "params"),
  audit,
  deleteRoleHandler,
);

/**
 * @openapi
 * /rbac/permissions:
 *   get:
 *     summary: List all permissions
 *     description: Returns every permission defined in the system.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PermissionListResponse'
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
router.get("/permissions", requirePermission(PERMISSIONS.PERMISSION_READ), listPermissionsHandler);

/**
 * @openapi
 * /rbac/permissions:
 *   post:
 *     summary: Create a permission
 *     description: Creates a new permission with a unique code.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermissionCreateRequest'
 *     responses:
 *       '201':
 *         description: Permission created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PermissionResponse'
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/permissions",
  requirePermission(PERMISSIONS.PERMISSION_CREATE),
  validate(createPermissionSchema),
  audit,
  createPermissionHandler,
);

/**
 * @openapi
 * /rbac/permissions/{id}:
 *   get:
 *     summary: Get a permission by id
 *     description: Returns a single permission.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Permission retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PermissionResponse'
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
  "/permissions/:id",
  requirePermission(PERMISSIONS.PERMISSION_READ),
  validate(idParamSchema, "params"),
  getPermissionHandler,
);

/**
 * @openapi
 * /rbac/permissions/{id}:
 *   patch:
 *     summary: Update a permission
 *     description: Updates a permission's code and/or description.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PermissionUpdateRequest'
 *     responses:
 *       '200':
 *         description: Permission updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PermissionResponse'
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
  "/permissions/:id",
  requirePermission(PERMISSIONS.PERMISSION_UPDATE),
  validate(idParamSchema, "params"),
  validate(updatePermissionSchema),
  audit,
  updatePermissionHandler,
);

/**
 * @openapi
 * /rbac/permissions/{id}:
 *   delete:
 *     summary: Delete a permission
 *     description: Deletes a permission. This also removes the permission from any role that had it.
 *     tags:
 *       - RBAC
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Permission deleted successfully
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
 *                       format: uuid
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
  "/permissions/:id",
  requirePermission(PERMISSIONS.PERMISSION_DELETE),
  validate(idParamSchema, "params"),
  audit,
  deletePermissionHandler,
);

// ─── Existing RBAC endpoints (preserved) ──────────────────────
/**
 * @openapi
 * /rbac/assign-role:
 *   post:
 *     tags: [RBAC]
 *     summary: Assign a role to a user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, roleId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               roleId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Role assigned
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden - requires admin.access }
 */
router.post("/assign-role", requirePermission(PERMISSIONS.ADMIN_ACCESS), assignRoleHandler);

/**
 * @openapi
 * /rbac/me/permissions:
 *   get:
 *     tags: [RBAC]
 *     summary: Get the current user's effective permissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Effective permission codes
 *       401: { description: Unauthorized }
 */
router.get("/me/permissions", authenticate, getMyPermissionsHandler);

export default router;
