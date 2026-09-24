import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { logger } from "../config/logger.js";
import { ROLES } from "../constants/roles.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { ConflictError, NotFoundError } from "../errors/errors.js";
import { authHelper } from "../helpers/auth.helper.js";
import { userRepository } from "../repositories/user.repository.js";

const {
  findByEmail,
  findById,
  findByIdWithRoleIds,
  list,
  count,
  countActiveAdmins,
  create,
  update,
  assignRole,
  delete: deleteUser,
  findRoleById,
} = userRepository;
const { encryptPassword } = authHelper;

type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
};

type Actor = { userId: string; email?: string };

function toSafeUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  roles: { role: { id: string; name: string } }[];
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    roles: user.roles.map((r) => r.role.name),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const userService = {
  /** GET /users — paginated list of users. */
  listUsers: async (options: { page: number; limit: number }, auditCtx?: AuditContext) => {
    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.limit);
    const [items, total] = await Promise.all([
      list({ skip: (page - 1) * limit, take: limit }),
      count(),
    ]);
    const result = {
      users: items.map(toSafeUser),
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

  /** GET /users/:id — single user. */
  getUserById: async (id: string, auditCtx?: AuditContext) => {
    const user = await findById(id);
    if (!user) {
      throw new NotFoundError("User");
    }
    await writeAudit(auditCtx, {
      action: AuditAction.USER_READ,
      resource: AuditResource.USER,
      resourceId: id,
      result: AuditResult.SUCCESS,
    });
    return toSafeUser(user);
  },

  /**
   * POST /users — create a user.
   * Password is hashed here (never stored in plaintext). Role assignment is
   * only performed because the caller already passed the route-layer
   * permission check (user:create). The role must exist.
   */
  createUser: async (
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      roleId: string;
    },
    actor: Actor,
    auditCtx?: AuditContext,
  ) => {
    const email = data.email.toLowerCase();

    const existing = await findByEmail(email);
    if (existing) {
      logger.warn(
        { requestId: auditCtx?.requestId, actorId: actor.userId, operation: "CREATE_USER", email },
        "User creation rejected: email already in use",
      );
      throw new ConflictError("A user with this email already exists");
    }

    const role = await findRoleById(data.roleId);
    if (!role) {
      throw new NotFoundError("Role");
    }

    const passwordHash = await encryptPassword(data.password);
    const user = await create({
      email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      roleId: data.roleId,
    });

    logger.info(
      {
        requestId: auditCtx?.requestId,
        actorId: actor.userId,
        operation: "CREATE_USER",
        userId: user.id,
        roleId: data.roleId,
      },
      "User created",
    );

    await writeAudit(auditCtx, {
      action: AuditAction.USER_CREATE,
      resource: AuditResource.USER,
      resourceId: user.id,
      result: AuditResult.SUCCESS,
      meta: { email: user.email, roleId: data.roleId },
    });

    return toSafeUser(user);
  },

  /**
   * PATCH /users/:id — update a user.
   * Only profile fields are updated here. If `roleId` is supplied it is
   * applied separately (the controller has already verified the caller holds
   * the role-management permission). Password, when supplied, is hashed.
   */
  updateUser: async (
    id: string,
    data: {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
      roleId?: string;
    },
    actor: Actor,
    auditCtx?: AuditContext,
  ) => {
    const existing = await findByIdWithRoleIds(id);
    if (!existing) {
      throw new NotFoundError("User");
    }

    const payload: {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
    } = {};

    if (data.email !== undefined) {
      const email = data.email.toLowerCase();
      if (email !== existing.email) {
        const duplicate = await findByEmail(email);
        if (duplicate) {
          throw new ConflictError("A user with this email already exists");
        }
        payload.email = email;
      }
    }
    if (data.firstName !== undefined) payload.firstName = data.firstName;
    if (data.lastName !== undefined) payload.lastName = data.lastName;
    if (data.isActive !== undefined) payload.isActive = data.isActive;
    if (data.password !== undefined) {
      payload.password = await encryptPassword(data.password);
    }

    const updated = await update(id, payload);

    // Role change is a privileged, separately-authorized operation.
    if (data.roleId !== undefined && data.roleId !== existing.roles[0]?.roleId) {
      const role = await findRoleById(data.roleId);
      if (!role) {
        throw new NotFoundError("Role");
      }
      const oldRoleId = existing.roles[0]?.roleId;
      await assignRole(id, data.roleId);
      logger.info(
        {
          requestId: auditCtx?.requestId,
          actorId: actor.userId,
          operation: "USER_ROLE_CHANGED",
          userId: id,
          oldRoleId,
          newRoleId: data.roleId,
        },
        "User role changed",
      );
      await writeAudit(auditCtx, {
        action: AuditAction.USER_ROLE_CHANGE,
        resource: AuditResource.USER,
        resourceId: id,
        result: AuditResult.SUCCESS,
        meta: { oldRoleId, newRoleId: data.roleId },
      });
    }

    logger.info(
      {
        requestId: auditCtx?.requestId,
        actorId: actor.userId,
        operation: "UPDATE_USER",
        userId: id,
        changedFields: Object.keys(payload),
      },
      "User updated",
    );

    await writeAudit(auditCtx, {
      action: AuditAction.USER_UPDATE,
      resource: AuditResource.USER,
      resourceId: id,
      result: AuditResult.SUCCESS,
      meta: { changedFields: Object.keys(payload) },
    });

    // Re-fetch so the response reflects the (possibly) new role.
    const refreshed = await findById(id);
    return refreshed ? toSafeUser(refreshed) : toSafeUser(updated);
  },

  /**
   * DELETE /users/:id — delete a user.
   * Guards: a caller may not delete their own account, and the last active
   * administrator is protected to avoid a full lockout.
   */
  deleteUser: async (id: string, actor: Actor, auditCtx?: AuditContext) => {
    const existing = await findById(id);
    if (!existing) {
      throw new NotFoundError("User");
    }

    if (id === actor.userId) {
      throw new ConflictError("You cannot delete your own account");
    }

    const isActiveAdmin =
      existing.isActive && existing.roles.some((r) => r.role.name === ROLES.ADMIN);
    if (isActiveAdmin) {
      const adminCount = await countActiveAdmins();
      if (adminCount <= 1) {
        logger.warn(
          {
            requestId: auditCtx?.requestId,
            actorId: actor.userId,
            operation: "DELETE_USER",
            userId: id,
          },
          "User deletion rejected: last active administrator",
        );
        throw new ConflictError("Cannot delete the last active administrator");
      }
    }

    await deleteUser(id);

    logger.info(
      {
        requestId: auditCtx?.requestId,
        actorId: actor.userId,
        operation: "DELETE_USER",
        userId: id,
      },
      "User deleted",
    );

    await writeAudit(auditCtx, {
      action: AuditAction.USER_DELETE,
      resource: AuditResource.USER,
      resourceId: id,
      result: AuditResult.SUCCESS,
      meta: { email: existing.email },
    });

    return { id };
  },
};
