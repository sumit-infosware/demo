import { Prisma } from "../../prisma/generated/prisma/client.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { logger } from "../config/logger.js";
import type { CountingMethod } from "../constants/device-types.js";
import { EVENT_TYPES } from "../constants/event-types.js";
import { ROLES } from "../constants/roles.js";
import { AlertSeverity, AlertType } from "../enums/alert.enum.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { NotFoundError, ValidationError } from "../errors/errors.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import { baselineRepository } from "../repositories/baseline.repository.js";
import { countCheckRepository } from "../repositories/count-check.repository.js";
import { tagRepository } from "../repositories/tags.repository.js";
import type {
  CaptureCountCheckInput,
  CountCheckDto,
  CountCheckResult,
} from "../types/count-check.types.js";
import { alertsService } from "./alerts.service.js";
import { countingService } from "./counting.service.js";
import { varianceService } from "./variance.service.js";

const { create, findByPacketTagId, list } = countCheckRepository;

type Actor = { userId: string; email?: string };

function toCountCheckDto(c: {
  id: bigint;
  packetTagId: bigint;
  baselineId: bigint;
  actualCount: Prisma.Decimal;
  baselineCount: Prisma.Decimal;
  matchesBaseline: boolean;
  varianceAmount: Prisma.Decimal | null;
  withinTolerance: boolean;
  managerOverride: boolean;
  overrideNotes: string | null;
  deviceId: string | null;
  checkedBy: string | null;
  checkedAt: Date;
}): CountCheckDto {
  return {
    id: c.id.toString(),
    packetTagId: c.packetTagId.toString(),
    baselineId: c.baselineId.toString(),
    actualCount: Number(c.actualCount.toString()),
    baselineCount: Number(c.baselineCount.toString()),
    matchesBaseline: c.matchesBaseline,
    varianceAmount: c.varianceAmount ? Number(c.varianceAmount.toString()) : null,
    withinTolerance: c.withinTolerance,
    managerOverride: c.managerOverride,
    overrideNotes: c.overrideNotes,
    deviceId: c.deviceId,
    checkedBy: c.checkedBy,
    checkedAt: c.checkedAt,
  };
}

export const countCheckService = {
  capture: async (
    data: CaptureCountCheckInput,
    actor: Actor,
    auditCtx?: AuditContext,
  ): Promise<CountCheckResult> => {
    const packetTagId = BigInt(data.packetTagId);

    const tag = await tagRepository.findById(packetTagId);
    if (!tag) throw new NotFoundError(`Packet tag ${data.packetTagId}`);

    const baseline = await baselineRepository.findByPacketTagId(packetTagId);
    if (!baseline) {
      throw new NotFoundError(
        `No baseline record found for packet ${data.packetTagId}. Must perform Transit Baseline first.`,
      );
    }

    const method = (data.method || baseline.method) as CountingMethod;
    const unitWeight =
      data.unitWeight ?? (baseline.unitWeight ? Number(baseline.unitWeight.toString()) : undefined);

    const captured = countingService.capture({
      method,
      manualCount: data.manualCount,
      unitWeight,
      totalWeight: data.totalWeight,
      reelReading: data.reelReading,
    });

    const baselineCount = baseline.baselineCount;
    const actualCount = captured.count;
    const varianceAmount = actualCount.minus(baselineCount);
    const matchesBaseline = varianceAmount.isZero();

    const absDiff = Math.abs(Number(varianceAmount.toString()));
    const isSmallItem = tag.uom === "NOS" && Number(baselineCount.toString()) >= 50;
    const allowedTolerance = isSmallItem ? 1 : 0;
    const withinTolerance = absDiff <= allowedTolerance;

    const requiresOverride = !withinTolerance && !data.managerOverride;
    if (requiresOverride) {
      throw new ValidationError(
        `Count check variance (${varianceAmount.toString()}) exceeds allowed tolerance (±${allowedTolerance}). Manager Override required to proceed.`,
        { absDiff, allowedTolerance, requiresOverride: true },
      );
    }

    const countCheck = await create({
      packetTagId,
      baselineId: baseline.id,
      actualCount,
      baselineCount,
      matchesBaseline,
      varianceAmount: !matchesBaseline ? varianceAmount : undefined,
      withinTolerance,
      managerOverride: data.managerOverride ?? false,
      overrideNotes: data.overrideNotes,
      deviceId: data.deviceId,
      checkedBy: actor.userId,
    });

    await tagRepository.updateStatus(packetTagId, "COUNT_CHECKED");

    await eventLogger.log({
      ref: tag.epc,
      eventType: matchesBaseline ? EVENT_TYPES.COUNT_CHECKED : EVENT_TYPES.COUNT_MISMATCH,
      phase: "7-CountCheck",
      device: data.deviceId,
      appUser: actor.userId,
      payload: {
        actualCount: Number(actualCount.toString()),
        baselineCount: Number(baselineCount.toString()),
        varianceAmount: Number(varianceAmount.toString()),
        withinTolerance,
        managerOverride: data.managerOverride ?? false,
      },
    });

    let alertRaised = false;
    if (!matchesBaseline) {
      await varianceService.record({
        context: "COUNT_CHECK",
        ref: tag.epc,
        expectedQty: Number(baselineCount.toString()),
        actualQty: Number(actualCount.toString()),
        raisedBy: actor.userId,
        notes: `Count check mismatch vs baseline for EPC ${tag.epc}: expected ${baselineCount.toString()}, got ${actualCount.toString()}`,
        auditCtx,
      });

      await alertsService.raise({
        type: AlertType.COUNT_CHECK_VARIANCE,
        severity: withinTolerance ? AlertSeverity.INFO : AlertSeverity.WARNING,
        message: `Count check variance for EPC ${tag.epc}: actual ${actualCount.toString()} vs baseline ${baselineCount.toString()}`,
        recipientRoles: [ROLES.TRANSIT_MANAGER, ROLES.HOLDING_MANAGER],
        sourceFn: "RF-36",
        ref: tag.epc,
        meta: {
          packetTagId: data.packetTagId,
          varianceAmount: Number(varianceAmount.toString()),
          withinTolerance,
        },
      });

      alertRaised = true;
    }

    logger.info(
      {
        requestId: auditCtx?.requestId,
        actorId: actor.userId,
        packetTagId: data.packetTagId,
        matchesBaseline,
        withinTolerance,
      },
      "Count check completed",
    );

    await writeAudit(auditCtx, {
      action: AuditAction.COUNT_CHECK_CREATE,
      resource: AuditResource.COUNT_CHECK,
      resourceId: data.packetTagId,
      result: AuditResult.SUCCESS,
      meta: {
        actualCount: Number(actualCount.toString()),
        baselineCount: Number(baselineCount.toString()),
        matchesBaseline,
        withinTolerance,
      },
    });

    return {
      countCheck: toCountCheckDto(countCheck),
      match: matchesBaseline,
      withinTolerance,
      varianceAmount: Number(varianceAmount.toString()),
      requiresOverride,
      alertRaised,
    };
  },

  getByPacketTagId: async (packetTagId: string, auditCtx?: AuditContext) => {
    const record = await findByPacketTagId(BigInt(packetTagId));
    if (!record) throw new NotFoundError(`Count check for packet ${packetTagId}`);

    await writeAudit(auditCtx, {
      action: AuditAction.COUNT_CHECK_READ,
      resource: AuditResource.COUNT_CHECK,
      resourceId: packetTagId,
      result: AuditResult.SUCCESS,
    });

    return toCountCheckDto(record);
  },

  listCountChecks: async (
    options: { mismatchesOnly?: boolean; page: number; limit: number },
    auditCtx?: AuditContext,
  ) => {
    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.limit);
    const { items, total } = await list({
      mismatchesOnly: options.mismatchesOnly,
      skip: (page - 1) * limit,
      take: limit,
    });

    await writeAudit(auditCtx, {
      action: AuditAction.COUNT_CHECK_LIST,
      resource: AuditResource.COUNT_CHECK,
      result: AuditResult.SUCCESS,
    });

    return {
      countChecks: items.map(toCountCheckDto),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
};
