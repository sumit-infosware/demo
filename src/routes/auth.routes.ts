import { Router } from "express";
import { PERMISSIONS } from "../constants/permissions.js";
import {
  changePassword,
  loginUser,
  logoutUser,
  refreshAccessToken,
} from "../controllers/auth.controller.js";
import { authenticate, requirePermission } from "../helpers/rbac.helper.js";
import { audit } from "../middleware/audit.middleware.js";
import { validate } from "../middleware/http.middleware.js";
import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
} from "../schemas/auth.schemas.js";

export const authRouter = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticates a user and returns an access token. A refresh token is set as an httpOnly cookie.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/LoginResponse'
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
authRouter.post("/login", validate(loginSchema), audit, loginUser);

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Exchanges a valid refresh token (cookie or request body) for a new access token and rotated refresh token.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       '200':
 *         description: New access token issued
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
 *                     accessToken:
 *                       type: string
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
authRouter.post("/refresh-token", validate(refreshTokenSchema), refreshAccessToken);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Revokes the current refresh token (cookie or request body) and clears the refresh-token cookie.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogoutRequest'
 *     responses:
 *       '200':
 *         description: Logged out successfully
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
 *                     message:
 *                       type: string
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
authRouter.post("/logout", validate(logoutSchema), audit, logoutUser);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     summary: Change a user's password
 *     description: |
 *       Changes the password for the account identified by `username` (matched against the user's email).
 *       Requires authentication and the `users.update` permission. The supplied `oldPassword` must match
 *       the current password, and `newPassword` must satisfy the project's password policy and match
 *       `confirmNewPassword`. Passwords are never returned and never logged.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       '200':
 *         description: Password changed successfully
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
 *                     success:
 *                       type: boolean
 *                       example: true
 *                 requestId:
 *                   type: string
 *                   example: req-abc123
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
authRouter.post(
  "/change-password",
  authenticate,
  requirePermission(PERMISSIONS.USER_UPDATE),
  validate(changePasswordSchema),
  audit,
  changePassword,
);
