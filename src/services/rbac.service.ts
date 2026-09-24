import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { AuditAction, AuditResource } from "../enums/audit.enum.js";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  prismaErrorToAppError,
} from "../errors/errors.js";
import { rbacRepository } from "../repositories/rbac.repository.js";

/**
 * RBAC service.
 * Resolves a user's single role and that role's permissions from the database
 * on every authorization check, so stale JWTs cannot grant elevated privileges.
 */
export const rbacService = {
  /** Resolves the authenticated user's role and permissions from the database. */
  resolveAccess: async (userId: string) => {
    const user = await rbacRepository.findUserWithAccess(userId);
    if (!user) {
      throw new AuthenticationError("User not found");
    }
    if (!user.isActive) {
      throw new AuthenticationError("Account is deactivated");
    }
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = new Set<string>();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.code);
      }
    }
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions: [...permissions],
    };
  },

  /** Returns true when the user holds every required permission. */
  hasPermissions: (userPermissions: string[], required: string[]): boolean =>
    required.every((p) => userPermissions.includes(p)),

  /** Returns true when the user holds at least one of the required permissions. */
  hasAnyPermission: (userPermissions: string[], required: string[]): boolean =>
    required.some((p) => userPermissions.includes(p)),

  listRoles: async () => rbacRepository.listRoles(),

  listPermissions: async () => rbacRepository.listPermissions(),

  /**
   * Assigns a single role to a user, replacing any existing roles.
   * Protected by the `role.update` permission at the route layer.
   */
  assignRole: async (userId: string, roleName: string) => {
    const role = await rbacRepository.findRoleByName(roleName);
    if (!role) {
      throw new NotFoundError("Role");
    }
    await rbacRepository.assignRole(userId, role.id);
    return { userId, role: role.name };
  },

  // ─── Role CRUD ───────────────────────────────────────────────
  createRole: async (
    data: { name: string; description?: string; permissionIds?: string[] },
    ctx?: AuditContext,
  ) => {
    const existing = await rbacRepository.findRoleByNameForCreate(data.name);
    if (existing) {
      throw new ConflictError(`Role "${data.name}" already exists`);
    }
    try {
      const role = await rbacRepository.createRole(data);
      await writeAudit(ctx, {
        action: AuditAction.ROLE_CREATE,
        resource: AuditResource.ROLE,
        resourceId: role.id,
        meta: { name: role.name, permissionIds: data.permissionIds ?? [] },
      });
      return role;
    } catch (err) {
      throw prismaErrorToAppError(err);
    }
  },

  getRoleById: async (id: string) => {
    const role = await rbacRepository.findRoleById(id);
    if (!role) {
      throw new NotFoundError("Role");
    }
    return role;
  },

  updateRole: async (
    id: string,
    data: { name?: string; description?: string | null; permissionIds?: string[] },
    ctx?: AuditContext,
  ) => {
    const existing = await rbacRepository.findRoleById(id);
    if (!existing) {
      throw new NotFoundError("Role");
    }
    if (data.name && data.name !== existing.name && existing.isSystem) {
      throw new ConflictError("System roles cannot be renamed");
    }
    try {
      const updated = await rbacRepository.updateRole(id, {
        name: data.name,
        description: data.description,
      });
      // Permission assignment is a full replace when provided.
      if (data.permissionIds) {
        await rbacRepository.setRolePermissions(id, data.permissionIds);
      }
      await writeAudit(ctx, {
        action: AuditAction.ROLE_UPDATE,
        resource: AuditResource.ROLE,
        resourceId: id,
        meta: { name: existing.name, permissionIds: data.permissionIds ?? [] },
      });
      return updated;
    } catch (err) {
      throw prismaErrorToAppError(err);
    }
  },

  deleteRole: async (id: string, ctx?: AuditContext) => {
    const existing = await rbacRepository.findRoleById(id);
    if (!existing) {
      throw new NotFoundError("Role");
    }
    if (existing.isSystem) {
      throw new ConflictError("System roles cannot be deleted");
    }
    try {
      await rbacRepository.deleteRole(id);
      await writeAudit(ctx, {
        action: AuditAction.ROLE_DELETE,
        resource: AuditResource.ROLE,
        resourceId: id,
      });
      return { id };
    } catch (err) {
      throw prismaErrorToAppError(err);
    }
  },

  // ─── Permission CRUD ─────────────────────────────────────────
  createPermission: async (data: { code: string; description?: string }, ctx?: AuditContext) => {
    const existing = await rbacRepository.findPermissionByCode(data.code);
    if (existing) {
      throw new ConflictError(`Permission "${data.code}" already exists`);
    }
    try {
      const permission = await rbacRepository.createPermission(data);
      await writeAudit(ctx, {
        action: AuditAction.PERMISSION_CREATE,
        resource: AuditResource.PERMISSION,
        resourceId: permission.id,
        meta: { code: permission.code },
      });
      return permission;
    } catch (err) {
      throw prismaErrorToAppError(err);
    }
  },

  getPermissionById: async (id: string) => {
    const permission = await rbacRepository.findPermissionById(id);
    if (!permission) {
      throw new NotFoundError("Permission");
    }
    return permission;
  },

  updatePermission: async (
    id: string,
    data: { code?: string; description?: string | null },
    ctx?: AuditContext,
  ) => {
    const existing = await rbacRepository.findPermissionById(id);
    if (!existing) {
      throw new NotFoundError("Permission");
    }
    try {
      const permission = await rbacRepository.updatePermission(id, data);
      await writeAudit(ctx, {
        action: AuditAction.PERMISSION_UPDATE,
        resource: AuditResource.PERMISSION,
        resourceId: id,
        meta: { code: permission.code },
      });
      return permission;
    } catch (err) {
      throw prismaErrorToAppError(err);
    }
  },

  deletePermission: async (id: string, ctx?: AuditContext) => {
    const existing = await rbacRepository.findPermissionById(id);
    if (!existing) {
      throw new NotFoundError("Permission");
    }
    try {
      await rbacRepository.deletePermission(id);
      await writeAudit(ctx, {
        action: AuditAction.PERMISSION_DELETE,
        resource: AuditResource.PERMISSION,
        resourceId: id,
      });
      return { id };
    } catch (err) {
      throw prismaErrorToAppError(err);
    }
  },

  /** Returns the effective permission codes for a given user (existing helper). */
  getMyPermissions: async (userId: string) => {
    const access = await rbacRepository.findUserWithAccess(userId);
    if (!access) {
      throw new NotFoundError("User not found");
    }
    return access.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code));
  },
};
