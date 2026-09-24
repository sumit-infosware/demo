import { randomBytes } from "node:crypto";
import { Prisma } from "../../prisma/generated/prisma/client.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { prisma } from "../config/clients.js";
import { DEVICE_TYPES } from "../constants/device-types.js";
import { EVENT_TYPES } from "../constants/event-types.js";
import { ROLES } from "../constants/roles.js";
import { AlertSeverity, AlertType } from "../enums/alert.enum.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { StockVerificationOutcome, StockVerificationTrigger } from "../enums/status.enum.js";
import { ConflictError, NotFoundError } from "../errors/errors.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import { emitIfsEvent } from "../ifs/realtime/ifs-realtime.js";
import { alertsService } from "./alerts.service.js";

/**
 * Phase 10 — Physical Stock Verification (flow 591, new_hal_flow.xml).
 *
 * Compares the stored-tag state of a location (from StorageConfirmation) with
 * the RFID tags actually read by the handheld to report:
 *   FOUND     — part/lot stored at the location and read on the floor (qty variance info-only)
 *   NOT_FOUND — stored at the location but not physically found
 *   EXTRA     — physically present but not stored at this location
 *
 * (IFS INVENTORY_STOCK is no longer mirrored into SITS — stock quantities were
 * dropped, so expected state is derived from stored placements.)
 *
 * Presence gaps (NOT_FOUND + EXTRA) raise a WARNING alert to admins. Quantity
 * variance on FOUND lines is recorded on the line but never alerts by itself.
 */

type Actor = { userId: string; email?: string };

export interface StockVerificationSyncItem {
  binRfidEpc: string;
  ifsLocationNo: string;
  warehouse?: string;
  scannedEpcs: string[];
  scannedAt?: string;
  offline?: boolean;
}

export interface StockVerificationLineDto {
  outcome: StockVerificationOutcome;
  itemCode: string;
  itemDesc: string | null;
  lotBatchNo: string | null;
  epc: string | null;
  packetTagId: string | null;
  qtyFound: number;
  qtyExpected: number;
  varianceQty: number;
  note: string | null;
}

interface PhysicalTag {
  epc: string;
  packetTagId: bigint;
  itemCode: string;
  itemDesc: string | null;
  lotBatchNo: string | null;
  qty: Prisma.Decimal;
}

interface ReconcileLineInput {
  outcome: StockVerificationOutcome;
  itemCode: string;
  itemDesc: string | null;
  lotBatchNo: string | null;
  epc: string | null;
  packetTagId: bigint | null;
  qtyFound: Prisma.Decimal;
  qtyExpected: Prisma.Decimal;
  varianceQty: Prisma.Decimal;
  note: string | null;
}

interface ReconcileResult {
  locationNo: string;
  lines: ReconcileLineInput[];
  foundCount: number;
  notFoundCount: number;
  extraCount: number;
}

function partLotKey(itemCode: string, lot: string | null): string {
  return `${itemCode}\u0000${lot ?? ""}`;
}

function newRunRef(): string {
  return `sv-${Date.now()}-${randomBytes(3).toString("hex")}`;
}

function toDecimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(typeof value === "number" ? String(value) : value);
}

/**
 * Mirrors one location: expected = stored placements (StorageConfirmation),
 * physical = the scanned/stored tags passed in. Outcomes are grouped per
 * (itemCode, lot).
 */
async function reconcileLocation(
  locationNo: string,
  physical: PhysicalTag[],
): Promise<ReconcileResult> {
  const storedRows = await prisma.storageConfirmation.findMany({
    where: { ifsLocationNo: locationNo },
    include: { packetTag: { include: { rrLine: { select: { itemDesc: true } } } } },
  });
  const expected = new Map<
    string,
    { itemCode: string; itemDesc: string | null; lotBatchNo: string | null; qty: Prisma.Decimal }
  >();
  for (const row of storedRows) {
    const tag = row.packetTag;
    if (tag.isVoided) continue;
    const key = partLotKey(tag.itemCode, tag.batchNo ?? null);
    const current = expected.get(key);
    expected.set(key, {
      itemCode: tag.itemCode,
      itemDesc: tag.rrLine?.itemDesc ?? null,
      lotBatchNo: tag.batchNo ?? null,
      qty: current ? current.qty.plus(toDecimal(tag.qty)) : toDecimal(tag.qty),
    });
  }

  const actual = new Map<
    string,
    {
      itemCode: string;
      itemDesc: string | null;
      lotBatchNo: string | null;
      qty: Prisma.Decimal;
      epc: string | null;
      packetTagId: bigint | null;
    }
  >();
  for (const tag of physical) {
    const key = partLotKey(tag.itemCode, tag.lotBatchNo);
    const current = actual.get(key);
    actual.set(key, {
      itemCode: tag.itemCode,
      itemDesc: tag.itemDesc,
      lotBatchNo: tag.lotBatchNo,
      qty: current ? current.qty.plus(tag.qty) : tag.qty,
      epc: current?.epc ?? tag.epc,
      packetTagId: current?.packetTagId ?? tag.packetTagId,
    });
  }

  const keys = new Set<string>([...expected.keys(), ...actual.keys()]);
  const lines: ReconcileLineInput[] = [];
  for (const key of keys) {
    const exp = expected.get(key);
    const act = actual.get(key);
    if (exp && act) {
      const varianceQty = act.qty.minus(exp.qty);
      lines.push({
        outcome: StockVerificationOutcome.FOUND,
        itemCode: exp.itemCode,
        itemDesc: act.itemDesc,
        lotBatchNo: exp.lotBatchNo,
        epc: act.epc,
        packetTagId: act.packetTagId,
        qtyFound: act.qty,
        qtyExpected: exp.qty,
        varianceQty,
        note: varianceQty.isZero()
          ? null
          : `qty variance vs stored: expected ${exp.qty.toString()}, found ${act.qty.toString()}`,
      });
    } else if (exp) {
      lines.push({
        outcome: StockVerificationOutcome.NOT_FOUND,
        itemCode: exp.itemCode,
        itemDesc: null,
        lotBatchNo: exp.lotBatchNo,
        epc: null,
        packetTagId: null,
        qtyFound: new Prisma.Decimal(0),
        qtyExpected: exp.qty,
        varianceQty: exp.qty.negated(),
        note: "present in stored placement but not physically found",
      });
    } else if (act) {
      lines.push({
        outcome: StockVerificationOutcome.EXTRA,
        itemCode: act.itemCode,
        itemDesc: act.itemDesc,
        lotBatchNo: act.lotBatchNo,
        epc: act.epc,
        packetTagId: act.packetTagId,
        qtyFound: act.qty,
        qtyExpected: new Prisma.Decimal(0),
        varianceQty: act.qty,
        note: "physically found but not stored at this location",
      });
    }
  }

  const foundCount = lines.filter((l) => l.outcome === StockVerificationOutcome.FOUND).length;
  const notFoundCount = lines.filter(
    (l) => l.outcome === StockVerificationOutcome.NOT_FOUND,
  ).length;
  const extraCount = lines.filter((l) => l.outcome === StockVerificationOutcome.EXTRA).length;
  return { locationNo, lines, foundCount, notFoundCount, extraCount };
}

interface CreatedRun {
  id: bigint;
  runRef: string;
  trigger: string;
  locationNo: string | null;
  deviceId: string | null;
  operatorId: string | null;
  foundCount: number;
  notFoundCount: number;
  extraCount: number;
  runAt: Date;
}

async function createRun(input: {
  trigger: string;
  locationNo: string | null;
  warehouse: string | null;
  binRfidEpc: string | null;
  deviceId: string | null;
  operatorId: string | null;
  offline: boolean;
  syncedAt: Date | null;
  result: ReconcileResult;
}): Promise<CreatedRun> {
  return prisma.stockVerificationRun.create({
    data: {
      runRef: newRunRef(),
      trigger: input.trigger,
      locationNo: input.locationNo,
      warehouse: input.warehouse,
      binRfidEpc: input.binRfidEpc,
      deviceId: input.deviceId,
      operatorId: input.operatorId,
      offline: input.offline,
      syncedAt: input.syncedAt,
      foundCount: input.result.foundCount,
      notFoundCount: input.result.notFoundCount,
      extraCount: input.result.extraCount,
      lines: {
        create: input.result.lines.map((l) => ({
          outcome: l.outcome,
          itemCode: l.itemCode,
          itemDesc: l.itemDesc,
          lotBatchNo: l.lotBatchNo,
          epc: l.epc,
          packetTagId: l.packetTagId,
          qtyFound: l.qtyFound,
          qtyExpected: l.qtyExpected,
          varianceQty: l.varianceQty,
          note: l.note,
        })),
      },
    },
    select: {
      id: true,
      runRef: true,
      trigger: true,
      locationNo: true,
      deviceId: true,
      operatorId: true,
      foundCount: true,
      notFoundCount: true,
      extraCount: true,
      runAt: true,
    },
  });
}

/** Event + event-log + (on discrepancy) WARNING alert. Swallows failures. */
function toRunDto(run: CreatedRun): Record<string, unknown> {
  return {
    runId: run.id.toString(),
    runRef: run.runRef,
    trigger: run.trigger,
    locationNo: run.locationNo,
    foundCount: run.foundCount,
    notFoundCount: run.notFoundCount,
    extraCount: run.extraCount,
    runAt: run.runAt,
  };
}

async function reportRun(run: CreatedRun): Promise<void> {
  const payload = toRunDto(run);
  emitIfsEvent("stock-verification.completed", payload);
  await eventLogger.log({
    ref: `sv/${run.locationNo ?? "all"}`,
    eventType: EVENT_TYPES.STOCK_VERIFICATION_COMPLETED,
    phase: "10-StockVerify",
    device: run.deviceId ?? undefined,
    appUser: run.operatorId ?? undefined,
    payload,
  });
  const discrepancy = run.notFoundCount + run.extraCount;
  if (discrepancy > 0) {
    await alertsService.raise({
      type: AlertType.STOCK_VERIFICATION_DISCREPANCY,
      severity: AlertSeverity.WARNING,
      message:
        `Stock verification ${run.runRef} at ${run.locationNo ?? "N/A"}: ` +
        `${run.notFoundCount} NOT_FOUND, ${run.extraCount} EXTRA, ${run.foundCount} FOUND.`,
      recipientRoles: [ROLES.ADMIN],
      sourceFn: "ifs.stock-verification",
      ref: `sv/${run.locationNo ?? "all"}`,
      meta: payload,
    });
  }
}

/** Physical state from StorageConfirmation (stored tags) for a location. */
async function physicalFromStorage(locationNo: string): Promise<PhysicalTag[]> {
  const confirmations = await prisma.storageConfirmation.findMany({
    where: { ifsLocationNo: locationNo },
    include: {
      packetTag: {
        include: { rrLine: { select: { itemDesc: true } } },
      },
    },
  });
  return confirmations
    .filter((c) => !c.packetTag.isVoided)
    .map((c) => ({
      epc: c.packetTag.epc,
      packetTagId: c.packetTag.id,
      itemCode: c.packetTag.itemCode,
      itemDesc: c.packetTag.rrLine?.itemDesc ?? null,
      lotBatchNo: c.packetTag.batchNo ?? null,
      qty: toDecimal(c.packetTag.qty),
    }));
}

async function listRuns(options: {
  page: number;
  limit: number;
  trigger?: string;
  locationNo?: string;
}) {
  const page = Math.max(1, options.page);
  const limit = Math.max(1, Math.min(100, options.limit));
  const where: Prisma.StockVerificationRunWhereInput = {
    ...(options.trigger ? { trigger: options.trigger } : {}),
    ...(options.locationNo ? { locationNo: options.locationNo } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.stockVerificationRun.findMany({
      where,
      orderBy: { runAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { lines: true } } },
    }),
    prisma.stockVerificationRun.count({ where }),
  ]);
  return {
    runs: items.map((r) => ({
      runId: r.id.toString(),
      runRef: r.runRef,
      trigger: r.trigger,
      locationNo: r.locationNo,
      warehouse: r.warehouse,
      deviceId: r.deviceId,
      offline: r.offline,
      foundCount: r.foundCount,
      notFoundCount: r.notFoundCount,
      extraCount: r.extraCount,
      lineCount: r._count.lines,
      status: r.status,
      runAt: r.runAt,
      syncedAt: r.syncedAt,
      createdAt: r.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export const stockVerificationService = {
  /**
   * Handheld re-dock: the device supplies the location it walked and the EPCs
   * it read (location tag + nearby packet tags). Each reported item becomes a
   * StockVerificationRun reconciled against the stored placements.
   */
  syncFromHandheld: async (
    items: StockVerificationSyncItem[],
    deviceId: string,
    actor: Actor,
    auditCtx?: AuditContext,
  ) => {
    const device = await prisma.deviceRegistry.findUnique({
      where: { deviceId },
    });
    if (!device) throw new NotFoundError(`Device ${deviceId}`);
    if (device.deviceType !== DEVICE_TYPES.HANDHELD || !device.isActive) {
      throw new ConflictError(`Device ${deviceId} must be an active HANDHELD`);
    }

    await writeAudit(auditCtx, {
      action: AuditAction.STOCK_VERIFICATION_STARTED,
      resource: AuditResource.STOCK_VERIFICATION,
      result: AuditResult.SUCCESS,
      meta: { deviceId, itemCount: items.length },
    });

    const runs: Record<string, unknown>[] = [];
    for (const item of items) {
      const tags = await prisma.packetTag.findMany({
        where: { epc: { in: item.scannedEpcs }, isVoided: false },
        include: { rrLine: { select: { itemDesc: true } } },
      });
      const physical: PhysicalTag[] = tags.map((t) => ({
        epc: t.epc,
        packetTagId: t.id,
        itemCode: t.itemCode,
        itemDesc: t.rrLine?.itemDesc ?? null,
        lotBatchNo: t.batchNo ?? null,
        qty: toDecimal(t.qty),
      }));
      const resolvedEpc = new Set(physical.map((p) => p.epc));
      const skippedEpcs = item.scannedEpcs.filter((epc) => !resolvedEpc.has(epc));

      const result = await reconcileLocation(item.ifsLocationNo, physical);
      const run = await createRun({
        trigger: StockVerificationTrigger.DEVICE,
        locationNo: item.ifsLocationNo,
        warehouse: item.warehouse ?? null,
        binRfidEpc: item.binRfidEpc,
        deviceId,
        operatorId: actor.userId,
        offline: item.offline ?? false,
        syncedAt: item.scannedAt ? new Date(item.scannedAt) : null,
        result,
      });
      await reportRun(run);
      runs.push({
        ...toRunDto(run),
        skippedEpcs,
        lines: result.lines.map((l) => ({
          outcome: l.outcome,
          itemCode: l.itemCode,
          itemDesc: l.itemDesc,
          lotBatchNo: l.lotBatchNo,
          epc: l.epc,
          packetTagId: l.packetTagId?.toString() ?? null,
          qtyFound: l.qtyFound.toNumber(),
          qtyExpected: l.qtyExpected.toNumber(),
          varianceQty: l.varianceQty.toNumber(),
          note: l.note,
        })),
      });
    }

    await writeAudit(auditCtx, {
      action: AuditAction.STOCK_VERIFICATION_COMPLETED,
      resource: AuditResource.STOCK_VERIFICATION,
      result: AuditResult.SUCCESS,
      meta: { deviceId, itemCount: items.length },
    });

    return { syncedCount: items.length, runs };
  },

  /** Admin-triggered reconciliation of a single location from stored tags. */
  runManual: async (locationNo: string, actor: Actor, auditCtx?: AuditContext) => {
    const { lines } = await runVerification({
      trigger: StockVerificationTrigger.MANUAL,
      locationNo,
      physical: await physicalFromStorage(locationNo),
      actor,
      auditCtx,
    });
    return {
      locationNo,
      foundCount: lines.filter((l) => l.outcome === StockVerificationOutcome.FOUND).length,
      notFoundCount: lines.filter((l) => l.outcome === StockVerificationOutcome.NOT_FOUND).length,
      extraCount: lines.filter((l) => l.outcome === StockVerificationOutcome.EXTRA).length,
    };
  },

  /** Periodic reconciliation of every known location (stored tags vs scan). */
  runScheduled: async () => {
    const locations = new Set<string>();
    const stored = await prisma.storageConfirmation.findMany({
      where: { ifsLocationNo: { not: null } },
      select: { ifsLocationNo: true },
    });
    for (const row of stored) {
      if (row.ifsLocationNo) locations.add(row.ifsLocationNo);
    }

    const results: Record<string, unknown>[] = [];
    for (const locationNo of locations) {
      const { lines, run } = await runVerification({
        trigger: StockVerificationTrigger.SCHEDULED,
        locationNo,
        physical: await physicalFromStorage(locationNo),
      });
      results.push({
        runRef: run.runRef,
        locationNo,
        foundCount: lines.filter((l) => l.outcome === StockVerificationOutcome.FOUND).length,
        notFoundCount: lines.filter((l) => l.outcome === StockVerificationOutcome.NOT_FOUND).length,
        extraCount: lines.filter((l) => l.outcome === StockVerificationOutcome.EXTRA).length,
      });
    }
    return { runCount: results.length, results };
  },

  listRuns: async (
    options: { page: number; limit: number; trigger?: string; locationNo?: string },
    auditCtx?: AuditContext,
  ) => {
    const result = await listRuns(options);
    await writeAudit(auditCtx, {
      action: AuditAction.STOCK_VERIFICATION_LIST,
      resource: AuditResource.STOCK_VERIFICATION_RUN,
      result: AuditResult.SUCCESS,
    });
    return result;
  },

  getRun: async (id: string, auditCtx?: AuditContext) => {
    const run = await prisma.stockVerificationRun.findUnique({
      where: { id: BigInt(id) },
      include: {
        lines: { orderBy: { id: "asc" } },
      },
    });
    if (!run) throw new NotFoundError(`Stock verification run ${id}`);
    await writeAudit(auditCtx, {
      action: AuditAction.STOCK_VERIFICATION_READ,
      resource: AuditResource.STOCK_VERIFICATION_RUN,
      resourceId: id,
      result: AuditResult.SUCCESS,
    });
    const lineDto: StockVerificationLineDto[] = run.lines.map((l) => ({
      outcome: l.outcome as StockVerificationOutcome,
      itemCode: l.itemCode,
      itemDesc: l.itemDesc,
      lotBatchNo: l.lotBatchNo,
      epc: l.epc,
      packetTagId: l.packetTagId?.toString() ?? null,
      qtyFound: l.qtyFound.toNumber(),
      qtyExpected: l.qtyExpected.toNumber(),
      varianceQty: l.varianceQty.toNumber(),
      note: l.note,
    }));
    return {
      runId: run.id.toString(),
      runRef: run.runRef,
      trigger: run.trigger,
      locationNo: run.locationNo,
      warehouse: run.warehouse,
      binRfidEpc: run.binRfidEpc,
      deviceId: run.deviceId,
      operatorId: run.operatorId,
      offline: run.offline,
      syncedAt: run.syncedAt,
      foundCount: run.foundCount,
      notFoundCount: run.notFoundCount,
      extraCount: run.extraCount,
      status: run.status,
      runAt: run.runAt,
      lines: lineDto,
    };
  },
};

async function runVerification(input: {
  trigger: StockVerificationTrigger;
  locationNo: string;
  physical: PhysicalTag[];
  actor?: Actor;
  auditCtx?: AuditContext;
}): Promise<{ lines: ReconcileLineInput[]; run: CreatedRun }> {
  if (input.actor) {
    await writeAudit(input.auditCtx, {
      action: AuditAction.STOCK_VERIFICATION_STARTED,
      resource: AuditResource.STOCK_VERIFICATION,
      result: AuditResult.SUCCESS,
      meta: { trigger: input.trigger, locationNo: input.locationNo },
    });
  }
  const result = await reconcileLocation(input.locationNo, input.physical);
  const run = await createRun({
    trigger: input.trigger,
    locationNo: input.locationNo,
    warehouse: null,
    binRfidEpc: null,
    deviceId: null,
    operatorId: input.actor?.userId ?? null,
    offline: false,
    syncedAt: null,
    result,
  });
  await reportRun(run);
  if (input.actor) {
    await writeAudit(input.auditCtx, {
      action: AuditAction.STOCK_VERIFICATION_COMPLETED,
      resource: AuditResource.STOCK_VERIFICATION_RUN,
      resourceId: run.id.toString(),
      result: AuditResult.SUCCESS,
      meta: { trigger: input.trigger, locationNo: input.locationNo },
    });
  }
  return { lines: result.lines, run };
}
