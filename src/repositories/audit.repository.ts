import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";
import { toAuditLogDto, type AuditLogListDto } from "../audit/audit-log.dto.js";
import { getScreenSearchTerms } from "../audit/audit-screens.js";
import { AUDIT_ACTION_LABELS, AUDIT_RESOURCE_LABELS } from "../constants/audit-labels.constants.js";

const AUDIT_LOG_USER_INCLUDE = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  },
} satisfies Prisma.AuditLogInclude;

type AuditLogWithUser = Prisma.AuditLogGetPayload<{ include: typeof AUDIT_LOG_USER_INCLUDE }>;

export interface AuditQuery {
  actorId?: string;
  actorEmail?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  screen?: string;
  result?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
  /** Free-text search across action/resource/screen/result/ip/agent/actor. */
  q?: string;
}

/** Reverse index: lowercase display label -> stored codes that share it. */
function buildLabelToCodes(labels: Record<string, string>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [code, label] of Object.entries(labels)) {
    const key = label.trim().toLowerCase();
    const existing = index.get(key);
    if (existing) existing.push(code);
    else index.set(key, [code]);
  }
  return index;
}

const ACTION_LABEL_INDEX = buildLabelToCodes(AUDIT_ACTION_LABELS);
const RESOURCE_LABEL_INDEX = buildLabelToCodes(AUDIT_RESOURCE_LABELS);

/** Codes whose display label contains the input (case-insensitive). */
function codesForLabel(index: Map<string, string[]>, input: string): string[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const codes: string[] = [];
  for (const [label, labelCodes] of index) {
    if (label.includes(q)) codes.push(...labelCodes);
  }
  return codes;
}

const contains = (field: Prisma.AuditLogScalarFieldEnum, value: string) =>
  ({ [field]: { contains: value, mode: "insensitive" } }) as Prisma.AuditLogWhereInput;

export const auditRepository = {
  /**
   * Returns a paginated list of audit logs ordered by most recent first,
   * mapped to the structured AuditLogDto shape (action/screen/resource/result
   * objects, generated description, and actor name).
   *
   * Filters are label-aware: action/resource/screen match both the stored raw
   * values and the human-readable labels shown in the UI, and actorEmail also
   * matches the actor's name. `q` performs a free-text OR search.
   */
  list: async (query: AuditQuery = {}): Promise<AuditLogListDto> => {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const where: Prisma.AuditLogWhereInput = {};
    const orBranches: Prisma.AuditLogWhereInput[] = [];

    if (query.actorId) where.userId = query.actorId;

    if (query.actorEmail) {
      orBranches.push({
        OR: [
          { metadata: { path: ["actorEmail"], string_contains: query.actorEmail } },
          { user: { firstName: { contains: query.actorEmail, mode: "insensitive" } } },
          { user: { lastName: { contains: query.actorEmail, mode: "insensitive" } } },
        ],
      });
    }

    if (query.action) {
      orBranches.push({
        OR: [
          contains("action", query.action),
          ...codesForLabel(ACTION_LABEL_INDEX, query.action).map((code) => ({
            action: code,
          })),
        ],
      });
    }

    if (query.resource) {
      orBranches.push({
        OR: [
          contains("resource", query.resource),
          ...codesForLabel(RESOURCE_LABEL_INDEX, query.resource).map((code) => ({
            resource: code,
          })),
        ],
      });
    }

    if (query.resourceId) where.resourceId = { contains: query.resourceId, mode: "insensitive" };

    if (query.screen) {
      orBranches.push({
        OR: getScreenSearchTerms(query.screen).map((term) => contains("screen", term)),
      });
    }

    if (query.result) where.result = { contains: query.result, mode: "insensitive" };

    if (query.q) {
      const q = query.q.trim();
      orBranches.push({
        OR: [
          contains("action", q),
          contains("resource", q),
          contains("resourceId", q),
          contains("screen", q),
          contains("result", q),
          contains("ip", q),
          contains("userAgent", q),
          { metadata: { path: ["actorEmail"], string_contains: q } },
          {
            user: {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
              ],
            },
          },
          // Label-aware matches so the user can search the displayed text.
          ...codesForLabel(ACTION_LABEL_INDEX, q).map((code) => ({ action: code })),
          ...codesForLabel(RESOURCE_LABEL_INDEX, q).map((code) => ({ resource: code })),
          ...getScreenSearchTerms(q).map((term) => contains("screen", term)),
        ],
      });
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = query.from;
      if (query.to) where.createdAt.lte = query.to;
    }

    if (orBranches.length > 0) where.AND = orBranches;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: AUDIT_LOG_USER_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const logs = items.map((item: AuditLogWithUser) => toAuditLogDto(item));

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
