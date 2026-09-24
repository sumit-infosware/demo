/**
 * DTO mapping for AuditLog rows — turns the raw persisted row into the
 * structured shape consumed by the activity-log UI:
 *
 * {
 *   id, action: { code, label }, description, performedBy: { id, name, role },
 *   screen: { code, label }, resource: { type, label, id },
 *   result: { code, label }, ip, userAgent, timestamp
 * }
 */
import { AUDIT_ACTION_LABELS, AUDIT_RESOURCE_LABELS } from "../constants/audit-labels.constants.js";
import { AuditAction } from "../enums/audit.enum.js";
import { buildDescription } from "./audit-descriptions.js";
import { getScreenInfo, type ScreenInfo } from "./audit-screens.js";

/** Structural row shape fed into the mapper (Prisma row + joined user). */
export interface AuditLogDtoRow {
  id: string;
  userId: string | null;
  action: string;
  screen: string | null;
  resource: string;
  resourceId: string | null;
  result: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    roles?: { role: { name: string } }[];
  } | null;
}

export interface AuditLogDto {
  id: string;
  action: { code: string; label: string };
  description: string;
  performedBy: { id: string | null; name: string | null; role: string | null };
  screen: { code: string; label: string };
  resource: { type: string; label: string; id: string | null };
  result: { code: string; label: string };
  ip: string | null;
  userAgent: string | null;
  timestamp: string;
}

export interface AuditLogListDto {
  data: AuditLogDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Reverse lookup: stored action value ("tag.generate") -> enum member name ("TAG_GENERATE"). */
const ACTION_TO_CODE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(AuditAction).map(([code, value]) => [value, code]),
);

function toPascalCase(value: string): string {
  return value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function metaAsRecord(metadata: unknown): Record<string, unknown> {
  return metadata !== null && typeof metadata === "object"
    ? (metadata as Record<string, unknown>)
    : {};
}

function resultToDto(result: string | null): { code: string; label: string } {
  const code = result?.toUpperCase() ?? "SUCCESS";
  const label = result ? result.charAt(0).toUpperCase() + result.slice(1) : "Success";
  return { code, label };
}

export function toAuditLogDto(row: AuditLogDtoRow): AuditLogDto {
  const meta = metaAsRecord(row.metadata);

  const actionCode = ACTION_TO_CODE[row.action] ?? row.action.toUpperCase();
  const actionLabel = AUDIT_ACTION_LABELS[row.action] ?? row.action;

  const resourceType = toPascalCase(row.resource);
  const resourceLabel = AUDIT_RESOURCE_LABELS[row.resource] ?? row.resource;

  const screen: ScreenInfo = getScreenInfo(row.screen);

  const performedBy = row.user
    ? {
        id: row.user.id,
        name: `${row.user.firstName} ${row.user.lastName}`.trim(),
        role:
          Array.isArray(meta.actorRole) && meta.actorRole.length > 0
            ? meta.actorRole.filter(Boolean).join(", ")
            : (row.user.roles?.map((r) => r.role.name).join(", ") ?? null),
      }
    : {
        id: row.userId,
        name: typeof meta.actorEmail === "string" ? meta.actorEmail : null,
        role:
          Array.isArray(meta.actorRole) && meta.actorRole.length > 0
            ? meta.actorRole.filter(Boolean).join(", ")
            : null,
      };

  return {
    id: row.id,
    action: { code: actionCode, label: actionLabel },
    description: buildDescription({
      action: row.action,
      meta,
      resourceLabel,
      resourceId: row.resourceId,
      screenLabel: screen.label,
    }),
    performedBy,
    screen: { code: screen.code, label: screen.label },
    resource: { type: resourceType, label: resourceLabel, id: row.resourceId },
    result: resultToDto(row.result),
    ip: row.ip,
    userAgent: row.userAgent,
    timestamp: row.createdAt.toISOString(),
  };
}
