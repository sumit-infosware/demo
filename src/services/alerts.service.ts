import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { logger } from "../config/logger.js";
import { ROLES } from "../constants/roles.js";
import { AlertChannel } from "../enums/alert.enum.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { NotFoundError } from "../errors/errors.js";
import { alertsRepository } from "../repositories/alerts.repository.js";
import type { AlertDto, RaiseAlertInput } from "../types/alerts.types.js";

const { create, findById, list, acknowledge } = alertsRepository;

type Actor = { userId: string; email?: string };

function toAlertDto(a: {
  id: bigint;
  type: string;
  severity: string;
  message: string;
  status: string;
  recipientRoles: string;
  channel: string;
  sourceFn: string | null;
  ref: string | null;
  meta: Prisma.JsonValue | null;
  createdAt: Date;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
}): AlertDto {
  return {
    id: a.id.toString(),
    type: a.type,
    severity: a.severity,
    message: a.message,
    status: a.status,
    recipientRoles: a.recipientRoles.split(",").map((r) => r.trim()),
    channel: a.channel,
    sourceFn: a.sourceFn,
    ref: a.ref,
    meta: a.meta as Record<string, unknown> | null,
    createdAt: a.createdAt,
    acknowledgedBy: a.acknowledgedBy,
    acknowledgedAt: a.acknowledgedAt,
  };
}

export const alertsService = {
  /**
   * Raises an in-app alert. Failures are logged but never break primary
   * business flow (same policy as writeAudit).
   */
  raise: async (input: RaiseAlertInput): Promise<void> => {
    try {
      await create({
        type: input.type,
        severity: input.severity,
        message: input.message,
        recipientRoles: input.recipientRoles.join(","),
        channel: AlertChannel.IN_APP,
        sourceFn: input.sourceFn,
        ref: input.ref,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      });
      logger.info(
        {
          type: input.type,
          severity: input.severity,
          sourceFn: input.sourceFn,
          ref: input.ref,
        },
        "Alert raised",
      );
    } catch (err) {
      logger.error({ err, type: input.type, ref: input.ref }, "alerts: failed to persist alert");
    }
  },

  listAlerts: async (
    options: {
      type?: string;
      severity?: string;
      status?: string;
      unreadOnly?: boolean;
      page: number;
      limit: number;
    },
    actor: Actor & { roles?: string[] },
    auditCtx?: AuditContext,
  ) => {
    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.limit);
    const { items, total } = await list({
      type: options.type,
      severity: options.severity,
      status: options.status,
      unreadOnly: options.unreadOnly,
      recipientRoles: actor.roles?.includes(ROLES.ADMIN) ? undefined : actor.roles,
      skip: (page - 1) * limit,
      take: limit,
    });

    await writeAudit(auditCtx, {
      action: AuditAction.ALERT_LIST,
      resource: AuditResource.ALERT,
      result: AuditResult.SUCCESS,
    });

    return {
      alerts: items.map(toAlertDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  acknowledgeAlert: async (id: string, actor: Actor, auditCtx?: AuditContext) => {
    const alertId = BigInt(id);
    const existing = await findById(alertId);
    if (!existing) throw new NotFoundError(`Alert ${id}`);

    const updated = await acknowledge(alertId, actor.userId);
    // `acknowledge` returns the alert (existing or updated) since we already verified existence
    if (!updated) throw new NotFoundError(`Alert ${id}`);

    await writeAudit(auditCtx, {
      action: AuditAction.ALERT_ACKNOWLEDGE,
      resource: AuditResource.ALERT,
      resourceId: id,
      result: AuditResult.SUCCESS,
    });

    return toAlertDto(updated);
  },
};
