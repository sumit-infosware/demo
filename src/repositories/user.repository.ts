import { prisma } from "../config/clients.js";
import { ROLES } from "../constants/roles.js";

/**
 * User data access for the User CRUD API.
 *
 * Every query uses an explicit `select` so that sensitive fields
 * (password, refreshToken, sessions, etc.) are never returned from the
 * database layer. Role assignment is handled through the UserRole join
 * (the application enforces the "exactly one role" invariant).
 */
const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      role: { select: { id: true, name: true } },
    },
  },
} as const;

export const userRepository = {
  /** Finds a user by id (safe projection, includes role names). */
  findById: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: userSelect,
    }),

  /** Finds a user by email (safe projection). Used for duplicate checks. */
  findByEmail: (email: string) =>
    prisma.user.findUnique({
      where: { email },
      select: userSelect,
    }),

  /** Finds a user by id including the raw role ids (for role-change diffing). */
  findByIdWithRoleIds: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        roles: { select: { roleId: true } },
      },
    }),

  /** Paginated list of users (safe projection). */
  list: (options: { skip: number; take: number }) =>
    prisma.user.findMany({
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: "desc" },
      select: userSelect,
    }),

  count: () => prisma.user.count(),

  /** Counts active users that hold the admin role (used to protect the last admin). */
  countActiveAdmins: () =>
    prisma.user.count({
      where: {
        isActive: true,
        roles: { some: { role: { name: ROLES.ADMIN } } },
      },
    }),

  /** Creates a new user with the supplied (already hashed) password and role. */
  create: (data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    roleId: string;
  }) =>
    prisma.user.create({
      data: {
        email: data.email,
        password: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        roles: {
          create: { roleId: data.roleId },
        },
      },
      select: userSelect,
    }),

  /** Updates a user's profile fields. Password is expected pre-hashed by the caller. */
  update: (
    id: string,
    data: {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
    },
  ) =>
    prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    }),

  /** Replaces a user's single role (application-enforced "exactly one role"). */
  assignRole: async (userId: string, roleId: string) =>
    prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      return tx.userRole.create({ data: { userId, roleId } });
    }),

  /** Hard-deletes a user. Sensitive cascade is handled by Prisma schema. */
  delete: (id: string) => prisma.user.delete({ where: { id } }),

  /** Resolves a role id from a role id (validates existence). */
  findRoleById: (roleId: string) =>
    prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true },
    }),
};
