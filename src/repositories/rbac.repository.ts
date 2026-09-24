import { prisma } from "../config/clients.js";

/**
 * RBAC data access.
 * Reuses the existing Prisma models: User, Role, Permission, UserRole, RolePermission.
 * Permissions are resolved from the database (never trusted from the client or JWT).
 */
export const rbacRepository = {
  /** Loads a user together with their role(s) and each role's permissions. */
  findUserWithAccess: (userId: string) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: {
                  select: {
                    permission: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),

  findRoleByName: (name: string) =>
    prisma.role.findUnique({
      where: { name },
      select: { id: true, name: true },
    }),

  /**
   * Resolves the users holding a given role name. Used by the transit-exit
   * alert module (RF-25) to address notifications to role-based recipients
   * (e.g. transit_manager, holding_manager) without hardcoding user IDs.
   */
  findUsersByRoleName: (name: string) =>
    prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { name } } },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    }),

  listRoles: () =>
    prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: {
          select: { permission: { select: { code: true, description: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),

  listPermissions: () =>
    prisma.permission.findMany({
      select: { id: true, code: true, description: true },
      orderBy: { code: "asc" },
    }),

  /**
   * Replaces a user's roles with a single role, enforcing the "exactly one role"
   * invariant at the application layer (the schema join is many-to-many).
   */
  assignRole: async (userId: string, roleId: string) =>
    prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      return tx.userRole.create({ data: { userId, roleId } });
    }),

  // ─── Role CRUD ───────────────────────────────────────────────
  findRoleById: (id: string) =>
    prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          select: {
            permission: { select: { id: true, code: true, description: true } },
          },
        },
      },
    }),

  findRoleByNameForCreate: (name: string) =>
    prisma.role.findUnique({ where: { name }, select: { id: true } }),

  createRole: (data: { name: string; description?: string; permissionIds?: string[] }) =>
    prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissionIds?.length
          ? {
              create: data.permissionIds.map((permissionId) => ({
                permissionId,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          select: {
            permission: { select: { id: true, code: true, description: true } },
          },
        },
      },
    }),

  updateRole: (id: string, data: { name?: string; description?: string | null }) =>
    prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          select: {
            permission: { select: { id: true, code: true, description: true } },
          },
        },
      },
    }),

  deleteRole: (id: string) => prisma.role.delete({ where: { id } }),

  /**
   * Replaces a role's permission set with the supplied ids.
   * The join is many-to-many, so we delete existing links and recreate them
   * inside a transaction to keep the relationship consistent.
   */
  setRolePermissions: async (roleId: string, permissionIds: string[]) =>
    prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
      return tx.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          name: true,
          description: true,
          isSystem: true,
          createdAt: true,
          updatedAt: true,
          permissions: {
            select: {
              permission: { select: { id: true, code: true, description: true } },
            },
          },
        },
      });
    }),

  // ─── Permission CRUD ─────────────────────────────────────────
  findPermissionById: (id: string) =>
    prisma.permission.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        description: true,
        createdAt: true,
      },
    }),

  findPermissionByCode: (code: string) =>
    prisma.permission.findUnique({ where: { code }, select: { id: true } }),

  createPermission: (data: { code: string; description?: string }) =>
    prisma.permission.create({
      data: { code: data.code, description: data.description },
      select: {
        id: true,
        code: true,
        description: true,
        createdAt: true,
      },
    }),

  updatePermission: (id: string, data: { code?: string; description?: string | null }) =>
    prisma.permission.update({
      where: { id },
      data: { code: data.code, description: data.description },
      select: {
        id: true,
        code: true,
        description: true,
        createdAt: true,
      },
    }),

  deletePermission: (id: string) => prisma.permission.delete({ where: { id } }),
};
