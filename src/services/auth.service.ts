import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { AuthenticationError, NotFoundError } from "../errors/errors.js";
import { authHelper } from "../helpers/auth.helper.js";
import { authRepository } from "../repositories/auth.repository.js";
import { rbacService } from "./rbac.service.js";

const {
  findUserByEmail,
  updateLastLogin,
  createSession,
  findSessionByJti,
  revokeSession,
  revokeSessionFamily,
  findUserById,
  listUsers,
  countUsers,
  hashToken,
} = authRepository;

const {
  verifyPassword,
  encryptPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = authHelper;

function toSafeUser(user: { id: string; email: string; firstName: string; lastName: string }) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

const REFRESH_TOKEN_EXPIRY_DEFAULT = "7d";

function parseExpiry(expiresIn: string): Date {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const value = parseInt(match[1]!, 10);
  const unit = match[2]! as "s" | "m" | "h" | "d";
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + value * (multipliers[unit] ?? 1));
}

export const authService = {
  login: async (
    data: { email: string; password: string; userAgent?: string; ip?: string },
    auditCtx?: AuditContext,
  ) => {
    const email = data.email.toLowerCase();
    const user = await findUserByEmail(email);
    if (!user) {
      await writeAudit(auditCtx, {
        action: AuditAction.AUTH_LOGIN,
        resource: AuditResource.AUTH,
        result: AuditResult.FAILURE,
        meta: { email, reason: "invalid_credentials" },
      });
      throw new AuthenticationError("Invalid credentials");
    }
    const isValid = await verifyPassword(data.password, user.password);
    if (!isValid) {
      await writeAudit(auditCtx, {
        action: AuditAction.AUTH_LOGIN,
        resource: AuditResource.AUTH,
        resourceId: user.id,
        result: AuditResult.FAILURE,
        meta: { email, reason: "invalid_credentials" },
      });
      throw new AuthenticationError("Invalid credentials");
    }
    if (!user.isActive) {
      await writeAudit(auditCtx, {
        action: AuditAction.AUTH_LOGIN,
        resource: AuditResource.AUTH,
        resourceId: user.id,
        result: AuditResult.FAILURE,
        meta: { email, reason: "account_deactivated" },
      });
      throw new AuthenticationError("Account is deactivated");
    }
    await updateLastLogin(user.id);
    const jti = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const accessToken = await generateAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await generateRefreshToken({
      sub: user.id,
      email: user.email,
      jti,
    });
    const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN ?? REFRESH_TOKEN_EXPIRY_DEFAULT;
    const expiresAt = parseExpiry(refreshExpiresIn);
    await createSession({
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      jti,
      userAgent: data.userAgent,
      ip: data.ip,
      expiresAt,
    });
    await writeAudit(auditCtx, {
      action: AuditAction.AUTH_LOGIN,
      resource: AuditResource.AUTH,
      resourceId: user.id,
      result: AuditResult.SUCCESS,
    });
    return {
      user: toSafeUser(user),
      accessToken,
      refreshToken,
    };
  },

  refreshToken: async (
    refreshToken: string | undefined,
    userAgent?: string,
    ip?: string,
    auditCtx?: AuditContext,
  ) => {
    if (!refreshToken) {
      throw new AuthenticationError("Refresh token is required");
    }
    const { payload } = await verifyRefreshToken(refreshToken);
    const { jti } = payload as { sub: string; jti: string };
    if (!jti) {
      throw new AuthenticationError("Invalid refresh token");
    }
    const session = await findSessionByJti(jti);
    if (!session) {
      throw new AuthenticationError("Refresh token not found");
    }
    if (session.revokedAt) {
      // Token reuse detected — revoke entire family
      await revokeSessionFamily(session.familyId);
      throw new AuthenticationError("Refresh token has been revoked");
    }
    if (session.expiresAt < new Date()) {
      throw new AuthenticationError("Refresh token has expired");
    }
    const user = await findUserByEmail(payload.email as string);
    if (!user || !user.isActive) {
      throw new AuthenticationError("User not found or deactivated");
    }
    // Rotate: revoke current, create new
    const newJti = crypto.randomUUID();
    const newRefreshToken = await generateRefreshToken({
      sub: user.id,
      email: user.email,
      jti: newJti,
    });
    const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN ?? REFRESH_TOKEN_EXPIRY_DEFAULT;
    const newExpiresAt = parseExpiry(refreshExpiresIn);
    await revokeSession(session.id, newJti);
    await createSession({
      userId: user.id,
      familyId: session.familyId,
      tokenHash: hashToken(newRefreshToken),
      jti: newJti,
      userAgent,
      ip,
      expiresAt: newExpiresAt,
    });
    const newAccessToken = await generateAccessToken({ sub: user.id, email: user.email });
    await writeAudit(auditCtx, {
      action: AuditAction.AUTH_REFRESH,
      resource: AuditResource.AUTH,
      resourceId: user.id,
      result: AuditResult.SUCCESS,
    });
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  logout: async (refreshToken: string | undefined, auditCtx?: AuditContext) => {
    if (!refreshToken) {
      // Idempotent: no token provided, nothing to do
      return;
    }
    try {
      const { payload } = await verifyRefreshToken(refreshToken);
      const { jti } = payload as { jti: string };
      if (jti) {
        const session = await findSessionByJti(jti);
        if (session && !session.revokedAt) {
          await revokeSession(session.id);
          await writeAudit(auditCtx, {
            action: AuditAction.AUTH_LOGOUT,
            resource: AuditResource.AUTH,
            resourceId: session.userId,
            result: AuditResult.SUCCESS,
          });
        }
      }
    } catch {
      // Invalid/expired token — idempotent logout, ignore
    }
  },

  logoutAll: async (userId: string, auditCtx?: AuditContext) => {
    await authRepository.revokeAllUserSessions(userId);
    await writeAudit(auditCtx, {
      action: AuditAction.AUTH_LOGOUT_ALL,
      resource: AuditResource.AUTH,
      resourceId: userId,
      result: AuditResult.SUCCESS,
    });
  },

  // ─── User / account management ──────────────────────────────
  listUsers: async (options: { page: number; limit: number }, auditCtx?: AuditContext) => {
    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.limit);
    const [items, total] = await Promise.all([
      listUsers({ skip: (page - 1) * limit, take: limit }),
      countUsers(),
    ]);
    const result = {
      users: items.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: u.isActive,
        roles: u.roles.map((r) => r.role.name),
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
    await writeAudit(auditCtx, {
      action: AuditAction.USER_LIST,
      resource: AuditResource.USER,
      result: AuditResult.SUCCESS,
    });
    return result;
  },

  getUserById: async (id: string, auditCtx?: AuditContext) => {
    const user = await findUserById(id);
    if (!user) {
      throw new NotFoundError("User");
    }
    const result = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles: user.roles.map((r) => r.role.name),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    await writeAudit(auditCtx, {
      action: AuditAction.USER_READ,
      resource: AuditResource.USER,
      resourceId: id,
      result: AuditResult.SUCCESS,
    });
    return result;
  },

  /**
   * Assigns a single role to a user (replacing any existing roles).
   * Authorization (role.update permission) is enforced at the route layer.
   */
  assignRole: async (userId: string, roleName: string, auditCtx?: AuditContext) => {
    const user = await findUserById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }
    const result = await rbacService.assignRole(userId, roleName);
    await writeAudit(auditCtx, {
      action: AuditAction.USER_ASSIGN_ROLE,
      resource: AuditResource.USER,
      resourceId: userId,
      result: AuditResult.SUCCESS,
      meta: { roleName },
    });
    return result;
  },

  /**
   * Changes a user's password.
   *
   * The project identifies users by `email`; the caller-supplied `username`
   * is matched against the `email` column. The requesting user must hold the
   * `users.update` permission (enforced at the route layer). The old password
   * is verified before any update, the new password is hashed with the
   * project's existing bcrypt helper, and the change is audited.
   */
  changePassword: async (
    data: { username: string; oldPassword: string; newPassword: string },
    ctx?: AuditContext,
  ) => {
    const user = await findUserByEmail(data.username);
    if (!user) {
      throw new NotFoundError("User");
    }
    if (!user.isActive) {
      throw new AuthenticationError("Account is deactivated");
    }

    const isOldPasswordValid = await verifyPassword(data.oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new AuthenticationError("Old password is incorrect");
    }

    const passwordHash = await encryptPassword(data.newPassword);
    await authRepository.updatePassword(user.id, passwordHash);

    await writeAudit(ctx, {
      action: AuditAction.USER_CHANGE_PASSWORD,
      resource: AuditResource.USER,
      resourceId: user.id,
      result: AuditResult.SUCCESS,
      meta: { email: user.email },
    });

    return { success: true };
  },
};
