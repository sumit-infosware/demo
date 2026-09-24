import { Prisma } from "../../prisma/generated/prisma/client.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { logger } from "../config/logger.js";
import { COUNTING_METHODS } from "../constants/device-types.js";
import { EVENT_TYPES } from "../constants/event-types.js";
import { ROLES } from "../constants/roles.js";
import { AlertSeverity, AlertType } from "../enums/alert.enum.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { RrLineStatus } from "../enums/status.enum.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors/errors.js";
import { countCalculator } from "../helpers/count-calculator.helper.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import { lineCountRepository, lineCountSelect } from "../repositories/line-count.repository.js";
import type {
  CaptureLineCountInput,
  CaptureLineCountResult,
  LineCountDto,
} from "../types/line-count.types.js";
import { alertsService } from "./alerts.service.js";
import { varianceService } from "./variance.service.js";

type Actor = { userId: string; email?: string };

/** null | undefined → skip; number → Decimal */
function toDecimal(v: number | null | undefined): Prisma.Decimal | undefined {
  if (v === undefined || v === null || Number.isNaN(v)) return undefined;
  return new Prisma.Decimal(v);
}

function hasNumber(v: number | null | undefined): v is number {
  return v !== undefined && v !== null && !Number.isNaN(v);
}

type LineCountRow = Prisma.LineCountGetPayload<{ select: typeof lineCountSelect }>;

function toDto(c: LineCountRow): LineCountDto {
  return {
    id: c.id.toString(),
    rrLineId: c.rrLineId.toString(),
    method: c.method,
    numPackages: c.numPackages,
    qtyPerPackage: Number(c.qtyPerPackage.toString()),
    unitWeightG: c.unitWeightG ? Number(c.unitWeightG.toString()) : null,
    totalWeightG: c.totalWeightG ? Number(c.totalWeightG.toString()) : null,
    reelReadingMtr: c.reelReadingMtr ? Number(c.reelReadingMtr.toString()) : null,
    pitchMm: c.pitchMm ? Number(c.pitchMm.toString()) : null,
    calculatedQty: Number(c.calculatedQty.toString()),
    operatorEditedQty: c.operatorEditedQty ? Number(c.operatorEditedQty.toString()) : null,
    finalCountedQty: Number(c.finalCountedQty.toString()),
    ifsChallanQty: Number(c.ifsChallanQty.toString()),
    varianceQty: Number(c.varianceQty.toString()),
    varianceFlag: c.varianceFlag,
    deviceId: c.deviceId,
    countedBy: c.countedBy,
    countedAt: c.countedAt,
    notes: c.notes,
  };
}

/** Diagram Phase 2: Counting BEFORE Tagging */
export const lineCountService = {
  capture: async (
    input: CaptureLineCountInput,
    actor: Actor,
    auditCtx?: AuditContext,
  ): Promise<CaptureLineCountResult> => {
    const rrLineId = BigInt(input.rrLineId);

    const line = await lineCountRepository.findRrLineForCounting(rrLineId);
    if (!line) throw new NotFoundError(`RR Line ${input.rrLineId}`);

    if (line.isSerialized) {
      throw new ValidationError(
        "Serialized items skip line counting. Proceed directly to tagging (1 tag per serial).",
      );
    }

    const terminalCountStatuses: string[] = [
      RrLineStatus.TAGGING,
      RrLineStatus.TAGGED,
      RrLineStatus.TRANSFERRED,
    ];
    if (terminalCountStatuses.includes(line.sitsStatus ?? "")) {
      throw new ConflictError(`Cannot recount line — already in status ${line.sitsStatus}`);
    }

    let calculatedQty: Prisma.Decimal;
    let unitWeightG: Prisma.Decimal | undefined;
    let totalWeightG: Prisma.Decimal | undefined;
    let reelReadingMtr: Prisma.Decimal | undefined;
    let pitchMm: Prisma.Decimal | undefined;

    if (input.method === COUNTING_METHODS.MANUAL) {
      if (!hasNumber(input.manualCount)) {
        throw new ValidationError("manualCount required for MANUAL method");
      }
      calculatedQty = new Prisma.Decimal(countCalculator.validateManual(input.manualCount));
    } else if (input.method === COUNTING_METHODS.WEIGHT) {
      if (!hasNumber(input.unitWeightG) || !hasNumber(input.totalWeightG)) {
        throw new ValidationError("unitWeightG + totalWeightG required for WEIGHT method");
      }
      if (input.unitWeightG <= 0) {
        throw new ValidationError("unitWeightG must be > 0 for WEIGHT method");
      }
      unitWeightG = new Prisma.Decimal(input.unitWeightG);
      totalWeightG = new Prisma.Decimal(input.totalWeightG);
      const res = countCalculator.fromWeight({
        totalWeight: totalWeightG,
        unitWeight: unitWeightG,
      });
      calculatedQty = new Prisma.Decimal(res.count);
    } else if (input.method === COUNTING_METHODS.REEL) {
      if (!hasNumber(input.reelReadingMtr)) {
        throw new ValidationError("reelReadingMtr required for REEL method");
      }
      reelReadingMtr = new Prisma.Decimal(input.reelReadingMtr);
      pitchMm = toDecimal(input.pitchMm);
      const count = countCalculator.fromReel(input.reelReadingMtr);
      calculatedQty = new Prisma.Decimal(count);
    } else {
      throw new ValidationError(`Invalid method: ${String(input.method)}`);
    }

    // ✅ null-safe override (fixes 500 when frontend sends operatorEditedQty: null)
    const finalQty = hasNumber(input.operatorEditedQty)
      ? new Prisma.Decimal(input.operatorEditedQty)
      : calculatedQty;

    const ifsChallanQty = new Prisma.Decimal(line.orderedQty.toString());
    const varianceQty = finalQty.minus(ifsChallanQty);
    const hasVariance = !varianceQty.isZero();

    const qtyPerPackage = new Prisma.Decimal(input.qtyPerPackage);

    const lineCount = await lineCountRepository.create({
      rrLineId,
      method: input.method,
      numPackages: input.numPackages,
      qtyPerPackage,
      unitWeightG,
      totalWeightG,
      reelReadingMtr,
      pitchMm,
      calculatedQty,
      operatorEditedQty: toDecimal(input.operatorEditedQty),
      finalCountedQty: finalQty,
      ifsChallanQty,
      varianceQty,
      varianceFlag: hasVariance,
      deviceId: input.deviceId ?? undefined,
      countedBy: actor.userId,
      notes: input.notes ?? undefined,
    });

    await lineCountRepository.updateRrLinePackaging(rrLineId, {
      numPackages: input.numPackages,
      qtyPerPackage,
      computedTotalQty: finalQty,
      sitsStatus: RrLineStatus.COUNTED,
    });

    const ref = `${line.rr.rrNo}/${line.rrLineNo}`;

    await eventLogger.log({
      ref,
      eventType: EVENT_TYPES.LINE_COUNT_CAPTURED,
      phase: "2-Counting",
      device: input.deviceId ?? undefined,
      appUser: actor.userId,
      payload: {
        rrLineId: input.rrLineId,
        method: input.method,
        calculatedQty: Number(calculatedQty.toString()),
        finalQty: Number(finalQty.toString()),
        ifsChallanQty: Number(ifsChallanQty.toString()),
        variance: hasVariance,
      },
    });

    let alertRaised = false;
    if (hasVariance) {
      await varianceService.record({
        context: "LINE_COUNT",
        ref,
        expectedQty: Number(ifsChallanQty.toString()),
        actualQty: Number(finalQty.toString()),
        raisedBy: actor.userId,
        notes: `Line counted ${finalQty.toString()} vs IFS challan ${ifsChallanQty.toString()}`,
        auditCtx,
      });

      await alertsService.raise({
        type: AlertType.LINE_COUNT_VARIANCE,
        severity: AlertSeverity.WARNING,
        message: `Counted ${finalQty.toString()} vs IFS challan ${ifsChallanQty.toString()} for line ${ref}`,
        recipientRoles: [ROLES.TRANSIT_MANAGER, ROLES.HOLDING_MANAGER],
        sourceFn: "LineCount",
        ref,
        meta: {
          rrLineId: input.rrLineId,
          variance: Number(varianceQty.toString()),
        },
      });
      alertRaised = true;

      await eventLogger.log({
        ref,
        eventType: EVENT_TYPES.LINE_COUNT_VARIANCE,
        phase: "2-Counting",
        appUser: actor.userId,
        payload: { variance: Number(varianceQty.toString()) },
      });
    }

    logger.info(
      {
        requestId: auditCtx?.requestId,
        actorId: actor.userId,
        rrLineId: input.rrLineId,
        method: input.method,
        variance: hasVariance,
      },
      "Line count captured",
    );

    await writeAudit(auditCtx, {
      action: AuditAction.LINE_COUNT_CREATE,
      resource: AuditResource.LINE_COUNT,
      resourceId: input.rrLineId,
      result: AuditResult.SUCCESS,
      meta: {
        method: input.method,
        finalQty: Number(finalQty.toString()),
        variance: hasVariance,
      },
    });

    return {
      lineCount: toDto(lineCount),
      variance: {
        hasVariance,
        amount: Number(varianceQty.toString()),
      },
      alertRaised,
      canProceedToTagging: true,
    };
  },

  getLatest: async (rrLineId: string): Promise<LineCountDto | null> => {
    const rec = await lineCountRepository.findLatestByRrLineId(BigInt(rrLineId));
    return rec ? toDto(rec) : null;
  },

  listByLine: async (rrLineId: string): Promise<LineCountDto[]> => {
    const recs = await lineCountRepository.findAllByRrLineId(BigInt(rrLineId));
    return recs.map(toDto);
  },
};
