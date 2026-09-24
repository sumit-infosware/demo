import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUser,
} from "../controllers/user.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import { createUserSchema, updateUserSchema, userIdParamSchema } from "../schemas/user.schemas.js";

const router = Router();

// Every User CRUD endpoint requires an authenticated caller.
router.use(authenticate);

/**
 * Enforces the role-management permission only when the request attempts to
 * change a user's role. Reuses the existing `requirePermission` middleware so
 * the same 403/AuthorizationError behavior applies. This prevents an ordinary
 * user with `user:update` from escalating privileges by supplying a roleId.
 */
const enforceRoleUpdateIfNeeded = (req: Request, res: Response, next: NextFunction): void => {
  const body = req.body as { roleId?: unknown } | undefined;
  if (body && body.roleId !== undefined) {
    requirePermission(PERMISSIONS.ROLE_UPDATE)(req, res, next);
    return;
  }
  next();
};

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List users
 *     description: Returns a paginated list of users. Requires the `user:read` permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, default: 20 }
 *     responses:
 *       '200':
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UserDetailResponse'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *                         total: { type: integer }
 *                         totalPages: { type: integer }
 *                 requestId: { type: string, example: req-abc123 }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.get("/", requirePermission(PERMISSIONS.USER_READ), listUsers);

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a user
 *     description: >
 *       Creates a new user. The password is hashed server-side and never
 *       returned. Assigning a role requires the `user:create` permission.
 *       The role must already exist.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreateRequest'
 *     responses:
 *       '201':
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/UserDetailResponse' }
 *                 requestId: { type: string, example: req-abc123 }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '409': { $ref: '#/components/responses/Conflict' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.post(
  "/",
  requirePermission(PERMISSIONS.USER_CREATE),
  validate(createUserSchema),
  audit,
  createUser,
);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a user by id
 *     description: Returns a single user. Requires the `user:read` permission.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/UserDetailResponse' }
 *                 requestId: { type: string, example: req-abc123 }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.get(
  "/:id",
  requirePermission(PERMISSIONS.USER_READ),
  validate(userIdParamSchema, "params"),
  getUserById,
);

/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     summary: Update a user
 *     description: >
 *       Updates a user's profile fields. Supplying `roleId` is a privileged
 *       operation and additionally requires the `roles.update` permission.
 *       When `password` is supplied it is hashed server-side.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       '200':
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/UserDetailResponse' }
 *                 requestId: { type: string, example: req-abc123 }
 *       '400': { $ref: '#/components/responses/ValidationError' }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *       '409': { $ref: '#/components/responses/Conflict' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.patch(
  "/:id",
  requirePermission(PERMISSIONS.USER_UPDATE),
  validate(userIdParamSchema, "params"),
  validate(updateUserSchema),
  enforceRoleUpdateIfNeeded,
  audit,
  updateUser,
);

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: >
 *       Deletes a user. Requires the `user:delete` permission. A caller may
 *       not delete their own account, and the last active administrator is
 *       protected.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                 requestId: { type: string, example: req-abc123 }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { $ref: '#/components/responses/Forbidden' }
 *       '404': { $ref: '#/components/responses/NotFound' }
 *       '409': { $ref: '#/components/responses/Conflict' }
 *       '500': { $ref: '#/components/responses/InternalServerError' }
 */
router.delete(
  "/:id",
  requirePermission(PERMISSIONS.USER_DELETE),
  validate(userIdParamSchema, "params"),
  audit,
  deleteUser,
);

export default router;
