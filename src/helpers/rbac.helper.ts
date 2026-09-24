import type { NextFunction, Request, Response } from "express";
import { AuthenticationError, AuthorizationError } from "../errors/errors.js";
import { rbacService } from "../services/rbac.service.js";
import type { AccountSnapshot } from "../types/common.js";
import { authHelper } from "./auth.helper.js";

/**
 * Authentication + authorization helpers (Express middleware factories).
 *
 * `authenticate` resolves the caller's identity and current role/permissions
 * from the database on every request, so authorization decisions never rely on
 * stale JWT claims.
 *
 * `requirePermission` / `requirePermissions` enforce permission-based access
 * control. Authorization is expressed in terms of permissions, not roles.
 */

/** Extracts the bearer access token from the Authorization header. */
function extractAccessToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header) {
    throw new AuthenticationError("Missing authorization header");
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new AuthenticationError("Invalid authorization format");
  }
  return token;
}

/** Authenticates the request and populates `req.user` from the database. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const token = extractAccessToken(req);
      const { payload } = await authHelper.verifyAccessToken(token);
      const sub = payload.sub;
      if (typeof sub !== "string" || !sub) {
        throw new AuthenticationError("Invalid access token");
      }
      const access = await rbacService.resolveAccess(sub);
      req.user = {
        userId: access.userId,
        email: access.email,
        firstName: access.firstName,
        lastName: access.lastName,
        roles: access.roles,
        permissions: access.permissions,
      } satisfies AccountSnapshot;
      next();
    } catch (err) {
      next(
        err instanceof AuthenticationError ? err : new AuthenticationError("Invalid access token"),
      );
    }
  })();
}

/** Enforces that the authenticated user holds a single required permission. */
export function requirePermission(permission: string) {
  return requirePermissions({ permissions: [permission], mode: "all" });
}

export type PermissionCheckMode = "all" | "any";

export interface PermissionCheckOptions {
  permissions: string[];
  mode?: PermissionCheckMode;
}

/**
 * Enforces that the authenticated user holds the required permissions.
 * `mode: "all"` (default) requires every permission; `mode: "any"` requires at least one.
 */
export function requirePermissions(options: PermissionCheckOptions) {
  const { permissions, mode = "all" } = options;
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      return next(new AuthenticationError("Authentication required"));
    }
    const granted = user.permissions;
    const allowed =
      mode === "any"
        ? rbacService.hasAnyPermission(granted, permissions)
        : rbacService.hasPermissions(granted, permissions);

    if (!allowed) {
      return next(
        new AuthorizationError(
          `Missing required permission: ${permissions.join(mode === "any" ? " OR " : " AND ")}`,
        ),
      );
    }
    next();
  };
}
