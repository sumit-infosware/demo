import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";
import { logger } from "../config/logger.js";
import { AuditAction, AuditResult } from "../enums/audit.enum.js";
import type { AuditContext, AuditOptions } from "./audit.types.js";

const ROUTINE_READ_ACTIONS = new Set<string>([
  AuditAction.ALERT_LIST,
  AuditAction.BASELINE_READ,
  AuditAction.BASELINE_LIST,
  AuditAction.BINNING_LOCATION_FIND,
  AuditAction.BINNING_LOCATION_LIST,
  AuditAction.BINNING_LOCATION_READ,
  AuditAction.BINNING_PLAN_READ,
  AuditAction.BINNING_PLAN_LIST,
  AuditAction.BINNING_PLAN_LINE_LOCATION_READ,
  AuditAction.COUNT_CHECK_READ,
  AuditAction.COUNT_CHECK_LIST,
  AuditAction.DEVICE_LIST,
  AuditAction.DEVICE_READ,
  AuditAction.HOLDING_LIST_PENDING,
  AuditAction.LINE_COUNT_READ,
  AuditAction.LINE_COUNT_LIST,
  AuditAction.PERMISSION_LIST,
  AuditAction.RR_LIST,
  AuditAction.RR_READ,
  AuditAction.RR_LINE_LIST,
  AuditAction.RR_LINE_READ,
  AuditAction.STOCK_VERIFICATION_LIST,
  AuditAction.STOCK_VERIFICATION_READ,
  AuditAction.TAG_READ,
  AuditAction.TAG_LIST,
  AuditAction.USER_LIST,
  AuditAction.USER_READ,
  AuditAction.VARIANCE_LIST,
  AuditAction.VARIANCE_READ,
]);

const ALLOW_UNAUTHENTICATED_ACTIONS = new Set<string>([
  AuditAction.AUTH_LOGIN,
  AuditAction.AUTH_LOGOUT,
  AuditAction.QC_STATUS_CHANGE,
  AuditAction.CHARGE_STATUS_CHANGE,
  AuditAction.IFS_SYNC_FAILED,
  AuditAction.IFS_SYNC_STOPPED,
]);

/**
 * Persists an audit record. Failures are swallowed (logged at error level)
 * so that auditing never breaks the primary business operation.
 *
 * Actorless writes are skipped by default. Explicit security/system actions
 * such as login failures and IFS stop/failure records are allowed to persist
 * with a null userId, while routine successful reads are suppressed centrally.
 */
export async function writeAudit(ctx: AuditContext | undefined, opts: AuditOptions): Promise<void> {
  if (
    ROUTINE_READ_ACTIONS.has(opts.action) &&
    (opts.result ?? AuditResult.SUCCESS) === AuditResult.SUCCESS
  ) {
    return;
  }

  if (!ctx?.actorId && !ALLOW_UNAUTHENTICATED_ACTIONS.has(opts.action)) {
    logger.debug(
      { action: opts.action, resource: opts.resource, requestId: ctx?.requestId },
      "audit: skipped, no authenticated user",
    );
    return;
  }

  const meta: Record<string, unknown> = {
    requestId: ctx?.requestId,
    actorEmail: ctx?.actorEmail,
    actorRole: ctx?.actorRole?.length ? ctx.actorRole : undefined,
    ...(opts.meta ?? {}),
  };

  try {
    await prisma.auditLog.create({
      data: {
        userId: ctx?.actorId ?? null,
        action: opts.action,
        screen: opts.screen ?? ctx?.screen ?? null,
        resource: opts.resource,
        resourceId: opts.resourceId ?? null,
        result: opts.result ?? AuditResult.SUCCESS,
        ip: ctx?.ip ?? null,
        userAgent: ctx?.userAgent ?? null,
        metadata: meta as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    logger.error(
      { err, action: opts.action, resource: opts.resource, requestId: ctx?.requestId },
      "audit: failed to persist audit record",
    );
  }
}
