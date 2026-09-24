import { createHash } from "node:crypto";
import { prisma } from "../config/clients.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const authRepository = {
  findUserByEmail: (email: string) =>
    prisma.user.findUnique({
      where: { email },
    }),

  updateLastLogin: (userId: string) =>
    prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    }),

  // Session management for refresh token rotation
  createSession: (data: {
    userId: string;
    familyId: string;
    tokenHash: string;
    jti: string;
    userAgent?: string;
    ip?: string;
    expiresAt: Date;
  }) =>
    prisma.session.create({
      data: {
        userId: data.userId,
        familyId: data.familyId,
        tokenHash: data.tokenHash,
        jti: data.jti,
        userAgent: data.userAgent,
        ip: data.ip,
        expiresAt: data.expiresAt,
      },
    }),

  findSessionByJti: (jti: string) =>
    prisma.session.findUnique({
      where: { jti },
    }),

  findSessionByTokenHash: (tokenHash: string) =>
    prisma.session.findUnique({
      where: { tokenHash },
    }),

  revokeSession: (sessionId: string, replacedByTokenId?: string) =>
    prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        replacedByTokenId,
      },
    }),

  revokeAllUserSessions: (userId: string) =>
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),

  revokeSessionFamily: (familyId: string) =>
    prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),

  // ─── User / account management ──────────────────────────────
  findUserById: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: { select: { name: true } },
          },
        },
      },
    }),

  listUsers: (options: { skip: number; take: number }) =>
    prisma.user.findMany({
      skip: options.skip,
      take: options.take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: { select: { name: true } },
          },
        },
      },
    }),

  countUsers: () => prisma.user.count(),

  hashToken,

  /** Updates a user's password hash (pre-hashed by the caller). */
  updatePassword: (userId: string, passwordHash: string) =>
    prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
      select: { id: true },
    }),
};
