import { Prisma } from "../../prisma/generated/prisma/client.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { logger } from "../config/logger.js";
import { EVENT_TYPES } from "../constants/event-types.js";
import { ROLES } from "../constants/roles.js";
import { AlertSeverity, AlertType } from "../enums/alert.enum.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { PacketTagStatus } from "../enums/status.enum.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors/errors.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import { baselineRepository } from "../repositories/baseline.repository.js";
import type {
  BaselineDto,
  CaptureBaselineInput,
  CaptureBaselineResult,
} from "../types/baseline.types.js";
import { alertsService } from "./alerts.service.js";
import { countingService } from "./counting.service.js";
import { varianceService } from "./variance.service.js";

const { findByPacketTagId, create, list, findPacketWithLine } = baselineRepository;

type Actor = { userId: string; email?: string };

function toBaselineDto(b: {
  id: bigint;
  packetTagId: bigint;
  method: string;
  unitWeight: Prisma.Decimal | null;
  totalWeight: Prisma.Decimal | null;
  baselineCount: Prisma.Decimal;
  ifsQtyAtCount: Prisma.Decimal;
  varianceFlag: boolean;
  varianceAmount: Prisma.Decimal | null;
  deviceId: string | null;
  countedBy: string | null;
  countedAt: Date;
  notes: string | null;
}): BaselineDto {
  return {
    id: b.id.toString(),
    packetTagId: b.packetTagId.toString(),
    method: b.method,
    unitWeight: b.unitWeight ? Number(b.unitWeight.toString()) : null,
    totalWeight: b.totalWeight ? Number(b.totalWeight.toString()) : null,
    baselineCount: Number(b.baselineCount.toString()),
    ifsQtyAtCount: Number(b.ifsQtyAtCount.toString()),
    varianceFlag: b.varianceFlag,
    varianceAmount: b.varianceAmount ? Number(b.varianceAmount.toString()) : null,
    deviceId: b.deviceId,
    countedBy: b.countedBy,
    countedAt: b.countedAt,
    notes: b.notes,
  };
}

export const baselineService = {
  /**
   * POST /baseline/capture — RF-13 → RF-20.
   * Captures baseline for a packet, compares vs IFS qty, records variance if
   * mismatch (flag & proceed — BR-06), raises alert (RF-19).
   */
  capture: async (
    data: CaptureBaselineInput,
    actor: Actor,
    auditCtx?: AuditContext,
  ): Promise<CaptureBaselineResult> => {
    const packetTagId = BigInt(data.packetTagId);

    // 1. Fetch packet with its RR line
    const packet = await findPacketWithLine(packetTagId);
    if (!packet) throw new NotFoundError(`Packet ${data.packetTagId}`);

    // 2. Guard: only commissioned tags can be baseline-counted
    if ((packet.status as PacketTagStatus) !== PacketTagStatus.COMMISSIONED) {
      throw new ValidationError(
        `Packet must be COMMISSIONED before baseline. Current status: ${packet.status}`,
      );
    }

    // 3. Guard: baseline already exists?
    const existing = await findByPacketTagId(packetTagId);
    if (existing) {
      throw new ConflictError(`Baseline already captured for packet ${data.packetTagId}`);
    }

    // 4. Compute count via shared counting service
    const captured = countingService.capture({
      method: data.method,
      manualCount: data.manualCount,
      unitWeight: data.unitWeight,
      totalWeight: data.totalWeight,
      reelReading: data.reelReading,
    });

    // 5. Compare vs IFS qty (the packet's assigned qty from tag time)
    const ifsQty = packet.qty; // qty on tag = qty derived from RR line
    const actualCount = captured.count;
    const varianceAmount = actualCount.minus(ifsQty);
    const hasVariance = !varianceAmount.isZero();

    // 6. Persist baseline
    const baseline = await create({
      packetTagId,
      method: captured.method,
      unitWeight: captured.unitWeight,
      totalWeight: captured.totalWeight,
      baselineCount: actualCount,
      ifsQtyAtCount: ifsQty,
      varianceFlag: hasVariance,
      varianceAmount: hasVariance ? varianceAmount : undefined,
      deviceId: data.deviceId,
      countedBy: actor.userId,
      notes: data.notes,
    });

    // 7. Event log
    await eventLogger.log({
      ref: packet.epc,
      eventType: EVENT_TYPES.BASELINE_COUNTED,
      phase: "3-Baseline",
      device: data.deviceId,
      appUser: actor.userId,
      payload: {
        packetTagId: data.packetTagId,
        method: captured.method,
        count: Number(actualCount.toString()),
        ifsQty: Number(ifsQty.toString()),
        variance: hasVariance,
      },
    });

    // 8. If variance, raise alert + record variance (RF-19, BR-06)
    let alertRaised = false;
    if (hasVariance) {
      await varianceService.record({
        context: "BASELINE",
        ref: packet.epc,
        expectedQty: Number(ifsQty.toString()),
        actualQty: Number(actualCount.toString()),
        raisedBy: actor.userId,
        notes: `Baseline count differs from IFS qty by ${varianceAmount.toString()} ${packet.uom}`,
        auditCtx,
      });

      await alertsService.raise({
        type: AlertType.BASELINE_VARIANCE,
        severity: AlertSeverity.WARNING,
        message: `Baseline count ${actualCount.toString()} differs from IFS qty ${ifsQty.toString()} for EPC ${packet.epc}`,
        recipientRoles: [ROLES.TRANSIT_MANAGER, ROLES.STORE_MANAGER],
        sourceFn: "RF-19",
        ref: packet.epc,
        meta: {
          packetTagId: data.packetTagId,
          varianceAmount: Number(varianceAmount.toString()),
          method: captured.method,
        },
      });

      alertRaised = true;

      await eventLogger.log({
        ref: packet.epc,
        eventType: EVENT_TYPES.BASELINE_VARIANCE,
        phase: "3-Baseline",
        appUser: actor.userId,
        payload: {
          varianceAmount: Number(varianceAmount.toString()),
        },
      });
    }

    logger.info(
      {
        requestId: auditCtx?.requestId,
        actorId: actor.userId,
        operation: "BASELINE_CAPTURE",
        packetTagId: data.packetTagId,
        method: captured.method,
        variance: hasVariance,
      },
      "Baseline captured",
    );

    await writeAudit(auditCtx, {
      action: AuditAction.BASELINE_CREATE,
      resource: AuditResource.BASELINE,
      resourceId: data.packetTagId,
      result: AuditResult.SUCCESS,
      meta: {
        method: captured.method,
        variance: hasVariance,
        varianceAmount: hasVariance ? Number(varianceAmount.toString()) : 0,
      },
    });

    return {
      baseline: toBaselineDto(baseline),
      variance: {
        hasVariance,
        amount: Number(varianceAmount.toString()),
      },
      alertRaised,
    };
  },

  getBaseline: async (packetTagId: string, auditCtx?: AuditContext): Promise<BaselineDto> => {
    const baseline = await findByPacketTagId(BigInt(packetTagId));
    if (!baseline) throw new NotFoundError(`Baseline for packet ${packetTagId}`);

    await writeAudit(auditCtx, {
      action: AuditAction.BASELINE_READ,
      resource: AuditResource.BASELINE,
      resourceId: packetTagId,
      result: AuditResult.SUCCESS,
    });

    return toBaselineDto(baseline);
  },

  listBaselines: async (
    options: {
      method?: string;
      varianceOnly?: boolean;
      page: number;
      limit: number;
    },
    auditCtx?: AuditContext,
  ) => {
    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.limit);
    const { items, total } = await list({
      method: options.method,
      varianceOnly: options.varianceOnly,
      skip: (page - 1) * limit,
      take: limit,
    });

    await writeAudit(auditCtx, {
      action: AuditAction.BASELINE_LIST,
      resource: AuditResource.BASELINE,
      result: AuditResult.SUCCESS,
    });

    return {
      baselines: items.map(toBaselineDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};
