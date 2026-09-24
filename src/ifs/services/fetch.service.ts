import type { Prisma } from "../../../prisma/generated/prisma/client.js";
import { writeAudit } from "../../audit/audit.service.js";
import { prisma } from "../../config/clients.js";
import { logger } from "../../config/logger.js";
import { ROLES } from "../../constants/roles.js";
import { AlertSeverity } from "../../enums/alert.enum.js";
import { AuditAction, AuditResource, AuditResult } from "../../enums/audit.enum.js";
import { PacketTagStatus } from "../../enums/status.enum.js";
import { eventLogger } from "../../helpers/event-logger.helper.js";
import { alertsService } from "../../services/alerts.service.js";
import { syncStorageHierarchy } from "../../services/storage-hierarchy.service.js";
import { IfsEventType } from "../enums/ifs-event.enum.js";
import {
  GATE_ENTRY_STATE,
  IFS_GATE_ENTRY_SYNC_STATE,
  type GateEntryState,
} from "../enums/ifs-sync-status.enum.js";
import { IfsSyncError } from "../errors/ifs.errors.js";
import { buildGateEntryPayload, type GateEntrySyncPayload } from "../mappers/fetch.mapper.js";
import { emitIfsEvent } from "../realtime/ifs-realtime.js";
import { ifsRepository } from "../repositories/ifs.repository.js";
import { isIfsCancelledStatus, isIfsRejectedStatus } from "../status/ifs-status.js";

/**
 * Common fetch/synchronization service.
 *
 * Shared by:
 *   - automatic polling (src/ifs/sync/sync-runner.ts)
 *   - manual fetch all / manual fetch one (src/ifs/services/manual-fetch.service.ts)
 *
 * Idempotent: a gate entry already present in SITS is classified
 * NEW / UPDATED / UNCHANGED and never duplicated. Only IFS-source fields are
 * overwritten; SITS-owned workflow data (sitsStatus, tags, counts, ownership
 * assignment, ...) is preserved.
 */

export interface GateEntrySyncResult {
  gateEntryNo: string;
  state: GateEntryState;
  rrId: string;
  linesCreated: number;
  linesUpdated: number;
  flaggedLines: number;
  fetchReadyLines: number;
}

/** Maps a GATE_ENTRY_STATE member to its canonical IFS sync event type. */
const GATE_ENTRY_SYNCED_EVENTS: Record<GateEntryState, IfsEventType> = {
  [GATE_ENTRY_STATE.NEW]: IfsEventType.GATE_ENTRY_SYNCED_NEW,
  [GATE_ENTRY_STATE.UPDATED]: IfsEventType.GATE_ENTRY_SYNCED_UPDATED,
  [GATE_ENTRY_STATE.UNCHANGED]: IfsEventType.GATE_ENTRY_SYNCED_UNCHANGED,
};

interface ExistingLineRow {
  rrLineNo: string;
  itemCode: string;
  orderedQty: Prisma.Decimal;
  qcStatus: string | null;
  chargeStatus: string | null;
  isHold: boolean;
  batchNo: string | null;
  poOwnership: string | null;
  isSerialized: boolean;
  vendorUom: string | null;
  stockingUom: string | null;
  ifsRejected: boolean;
  unvoidedTagCount: number;
  serialNumbers: string | null;
  serialsMissingAlerted: boolean;
}

interface ExistingRrRow {
  id: bigint;
  vendorNo: string | null;
  ownership: string | null;
}

/** A line that transitioned to IFS Rejected during this sync (post-commit effects). */
interface RejectedLineTransition {
  rrLineId: string;
  rrLineNo: string;
  itemCode: string;
  qcStatus: string | null;
}

/** A line whose tags were auto-voided because IFS marked it Cancelled (post-commit effects). */
interface CancelledLineTransition {
  rrLineId: string;
  rrLineNo: string;
  itemCode: string;
  voidedTagCount: number;
}

/** A serialized line found without serials during this sync (post-commit effects). */
interface SerialsMissingTransition {
  rrLineId: string;
  rrLineNo: string;
  itemCode: string;
}

/** Mirrors only the IFS-source RR fields that are actually re-written on update. */
function rrSourceEquals(existing: ExistingRrRow, payload: GateEntrySyncPayload): boolean {
  return (
    existing.vendorNo === payload.rr.vendorNo &&
    (existing.ownership ?? null) === payload.rr.poOwnership
  );
}

function lineSourceEquals(
  existing: ExistingLineRow,
  line: GateEntrySyncPayload["rr"]["lines"][number],
): boolean {
  return (
    existing.rrLineNo === line.rrLineNo &&
    existing.itemCode === line.itemCode &&
    existing.orderedQty.equals(line.orderedQty) &&
    existing.qcStatus === line.qcStatus &&
    existing.chargeStatus === line.chargeStatus &&
    existing.isHold === line.isHold &&
    (existing.batchNo ?? null) === line.batchNo &&
    (existing.poOwnership ?? null) === line.poOwnership &&
    existing.isSerialized === line.isSerialized &&
    (existing.vendorUom ?? null) === line.vendorUom &&
    (existing.stockingUom ?? null) === line.stockingUom &&
    (existing.serialNumbers ?? null) === line.serialNumbers
  );
}

export const fetchService = {
  /**
   * Loads the complete gate entry (header, details, part masters, part-scoped
   * locations) from IFS and synchronizes it into SITS inside one transaction.
   * Throws IfsSyncError on failure so the caller can record/retry.
   */
  syncGateEntry: async (
    gateEntryNo: string,
    fetchReadyQcStatus: string,
  ): Promise<GateEntrySyncResult> => {
    const header = await ifsRepository.findGateEntryHeader(gateEntryNo);
    if (!header) {
      throw new IfsSyncError(gateEntryNo, `Gate entry ${gateEntryNo} not found in IFS`);
    }
    const details = await ifsRepository.listGateEntryDetails(gateEntryNo);

    const partNos = [
      ...new Set(details.map((d) => d.partNo).filter((p): p is string => Boolean(p))),
    ];
    const parts = new Map<string, Awaited<ReturnType<typeof ifsRepository.findPartCatalog>>>();
    const inventoryParts = new Map<
      string,
      Awaited<ReturnType<typeof ifsRepository.findInventoryPart>>
    >();
    for (const partNo of partNos) {
      parts.set(partNo, await ifsRepository.findPartCatalog(partNo));
      inventoryParts.set(partNo, await ifsRepository.findInventoryPart(partNo));
    }

    const locations = new Map<
      string,
      Awaited<ReturnType<typeof ifsRepository.listLocationsForPart>>
    >();
    for (const partNo of partNos) {
      locations.set(partNo, await ifsRepository.listLocationsForPart(partNo));
    }

    const payload = buildGateEntryPayload({
      header,
      details,
      parts,
      inventoryParts,
      locations,
    });

    emitIfsEvent("gate-entry.detected", {
      gateEntryNo,
      gateEntryDate: header.gateEntryDate,
      status: "detected",
      detailCount: details.length,
      flaggedLines: payload.flaggedLineCount,
    });

    return fetchService.applyPayload(gateEntryNo, payload, fetchReadyQcStatus);
  },

  /** Persists the normalized payload idempotently within a single transaction. */
  applyPayload: async (
    gateEntryNo: string,
    payload: GateEntrySyncPayload,
    fetchReadyQcStatus: string,
  ): Promise<GateEntrySyncResult> => {
    const sourceRr = payload.rr;

    const existing = await prisma.rr.findFirst({
      where: { gateEntryNo },
      select: { id: true, vendorNo: true, ownership: true },
    });

    const existingRows = existing
      ? await prisma.rrLine.findMany({
          where: { rrId: existing.id },
          select: {
            rrLineNo: true,
            itemCode: true,
            orderedQty: true,
            qcStatus: true,
            chargeStatus: true,
            isHold: true,
            batchNo: true,
            poOwnership: true,
            isSerialized: true,
            vendorUom: true,
            stockingUom: true,
            ifsRejected: true,
            serialNumbers: true,
            serialsMissingAlerted: true,
            _count: {
              select: { packetTags: { where: { isVoided: false } } },
            },
          },
        })
      : [];
    const existingLines: ExistingLineRow[] = existingRows.map((r) => ({
      rrLineNo: r.rrLineNo,
      itemCode: r.itemCode,
      orderedQty: r.orderedQty,
      qcStatus: r.qcStatus,
      chargeStatus: r.chargeStatus,
      isHold: r.isHold,
      batchNo: r.batchNo,
      poOwnership: r.poOwnership,
      isSerialized: r.isSerialized,
      vendorUom: r.vendorUom,
      stockingUom: r.stockingUom,
      ifsRejected: r.ifsRejected,
      unvoidedTagCount: r._count.packetTags,
      serialNumbers: r.serialNumbers,
      serialsMissingAlerted: r.serialsMissingAlerted,
    }));

    // Idempotent classification.
    let state: GateEntryState = GATE_ENTRY_STATE.NEW;
    if (existing) {
      const rrSame = rrSourceEquals(existing, payload);
      const linesById = new Map(existingLines.map((l) => [l.rrLineNo, l]));
      const maxLines = Math.max(existingLines.length, payload.rr.lines.length);
      const linesSame =
        maxLines === 0 ||
        payload.rr.lines.every((line) => {
          const cur = linesById.get(line.rrLineNo);
          // Terminal IFS-rejected line — frozen forever. Even if IFS later
          // changes the line, it must never re-trigger an update.
          if (cur?.ifsRejected) return true;
          // One-time backfill: a line IFS reports as Rejected that SITS has
          // not yet marked terminal (pre-existing rows from before this
          // feature) must trigger a sync so the terminal flag gets set.
          if (cur && !line.flagReason && isIfsRejectedStatus(line.qcStatus)) return false;
          // Cancelled line with live tags — the sync must run so the tags are
          // auto-voided. Idempotent: once the tags are voided the count drops
          // to zero and the line returns to a normal comparison.
          if (
            cur &&
            !line.flagReason &&
            cur.unvoidedTagCount > 0 &&
            isIfsCancelledStatus(line.qcStatus)
          )
            return false;
          // Serialized line without serials that hasn't been flagged yet — run
          // the sync once so the missing-serial WARNING is raised (dedupe flag).
          if (
            cur &&
            cur.isSerialized &&
            !line.flagReason &&
            (line.serialNumbers ?? "").trim() === "" &&
            !cur.serialsMissingAlerted
          )
            return false;
          return cur !== undefined && lineSourceEquals(cur, line);
        });
      state = rrSame && linesSame ? GATE_ENTRY_STATE.UNCHANGED : GATE_ENTRY_STATE.UPDATED;
    }

    const existingLineMap = new Map(existingLines.map((l) => [l.rrLineNo, l]));
    let linesCreated = 0;
    let linesUpdated = 0;
    let fetchReadyLines = 0;
    const rejectedTransitions: RejectedLineTransition[] = [];
    const cancelledTransitions: CancelledLineTransition[] = [];
    const serialsMissingTransitions: SerialsMissingTransition[] = [];

    try {
      if (state === GATE_ENTRY_STATE.UNCHANGED) {
        logger.debug({ gateEntryNo }, "ifs:sync_unchanged");
      } else if (state === GATE_ENTRY_STATE.NEW || state === GATE_ENTRY_STATE.UPDATED) {
        await prisma.$transaction(async (tx) => {
          const rr = existing
            ? await tx.rr.update({
                where: { id: existing.id },
                // Only overwrites IFS-source fields. rrStatus is SITS workflow
                // data (set once on create) and must never be clobbered by a
                // re-poll — the supplied IFS schema has no GE status column,
                // so there is nothing to mirror on updates.
                data: {
                  vendorNo: sourceRr.vendorNo,
                  ownership: sourceRr.poOwnership,
                },
              })
            : await tx.rr.create({
                data: {
                  rrNo: sourceRr.rrNo,
                  gateEntryNo,
                  sourceType: "DOMESTIC",
                  vendorNo: sourceRr.vendorNo,
                  vendorName: sourceRr.vendorName ?? null,
                  ownership: sourceRr.poOwnership,
                  rrStatus: sourceRr.rrStatus,
                  rrDate: sourceRr.gateEntryDate,
                },
              });

          for (const line of sourceRr.lines) {
            if (line.flagReason) {
              await eventLogger.log({
                ref: `${gateEntryNo}/${line.rrLineNo}`,
                eventType: IfsEventType.GATE_ENTRY_LINE_FLAGGED,
                phase: "FETCH_QC",
                payload: { reason: line.flagReason, itemCode: line.itemCode },
              });
              continue;
            }

            const prev = existingLineMap.get(line.rrLineNo) ?? null;

            // Terminal IFS-rejected line — never re-synced. IFS data for this
            // line is frozen: further IFS changes (even away from Rejected)
            // must not alter it (flow cells 533/534/543).
            if (prev?.ifsRejected) {
              continue;
            }

            const isRejectedNow = isIfsRejectedStatus(line.qcStatus);
            const becomesRejected = isRejectedNow && !prev?.ifsRejected;

            const serializedMissing = line.isSerialized && (line.serialNumbers ?? "").trim() === "";
            const serialsArrived = line.isSerialized && (line.serialNumbers ?? "").trim() !== "";
            const firstMissingSerials = serializedMissing && !prev?.serialsMissingAlerted;

            const create = {
              rrId: rr.id,
              rrLineNo: line.rrLineNo,
              gateEntryNo,
              gateEntryLineNo: line.gateEntryLineNo,
              receiptNo: line.receiptNo,
              itemCode: line.itemCode,
              itemDesc: line.itemDesc,
              orderedQty: line.orderedQty,
              receivedQty: line.receivedQty,
              acceptedQty: line.acceptedQty,
              vendorUom: line.vendorUom,
              stockingUom: line.stockingUom,
              conversionFactor: line.conversionFactor,
              inventoryQty: line.inventoryQty,
              noteText: line.noteText,
              isChargeApproved: line.isChargeApproved,
              isHold: line.isHold,
              qcStatus: line.qcStatus,
              chargeStatus: line.chargeStatus,
              batchNo: line.batchNo,
              itemType: line.itemType,
              isSerialized: line.isSerialized,
              isFractionalQty: line.isFractionalQty,
              computedTotalQty: line.computedTotalQty,
              poOwnership: line.poOwnership,
              ifsRejected: becomesRejected,
              ifsRejectedAt: becomesRejected ? new Date() : null,
              serialNumbers: line.serialNumbers,
              serialsMissingAlerted: serializedMissing,
              serialsMissingAlertedAt: serializedMissing ? new Date() : null,
            } satisfies Prisma.RrLineUncheckedCreateInput;

            const updated = await tx.rrLine.upsert({
              where: { rrId_rrLineNo: { rrId: rr.id, rrLineNo: line.rrLineNo } },
              update: {
                itemCode: create.itemCode,
                itemDesc: create.itemDesc,
                orderedQty: create.orderedQty,
                receivedQty: create.receivedQty,
                acceptedQty: create.acceptedQty,
                vendorUom: create.vendorUom,
                stockingUom: create.stockingUom,
                conversionFactor: create.conversionFactor,
                inventoryQty: create.inventoryQty,
                noteText: create.noteText,
                isChargeApproved: create.isChargeApproved,
                isHold: create.isHold,
                qcStatus: create.qcStatus,
                chargeStatus: create.chargeStatus,
                batchNo: create.batchNo,
                itemType: create.itemType,
                isSerialized: create.isSerialized,
                isFractionalQty: create.isFractionalQty,
                computedTotalQty: create.computedTotalQty,
                poOwnership: create.poOwnership,
                ...(becomesRejected ? { ifsRejected: true, ifsRejectedAt: new Date() } : {}),
                serialNumbers: create.serialNumbers,
                ...(firstMissingSerials
                  ? { serialsMissingAlerted: true, serialsMissingAlertedAt: new Date() }
                  : {}),
                ...(serialsArrived && prev?.serialsMissingAlerted
                  ? { serialsMissingAlerted: false, serialsMissingAlertedAt: null }
                  : {}),
              },
              create,
            });

            if (prev) linesUpdated += 1;
            else linesCreated += 1;

            if (prev?.qcStatus !== line.qcStatus) {
              await writeAudit(undefined, {
                action: AuditAction.QC_STATUS_CHANGE,
                resource: AuditResource.RR_LINE,
                resourceId: updated.id.toString(),
                result: AuditResult.SUCCESS,
                meta: { gateEntryNo, rrLineNo: line.rrLineNo, status: line.qcStatus },
              });
            }

            if (prev?.chargeStatus !== line.chargeStatus) {
              await writeAudit(undefined, {
                action: AuditAction.CHARGE_STATUS_CHANGE,
                resource: AuditResource.RR_LINE,
                resourceId: updated.id.toString(),
                result: AuditResult.SUCCESS,
                meta: { gateEntryNo, rrLineNo: line.rrLineNo, status: line.chargeStatus },
              });
            }

            if (becomesRejected) {
              rejectedTransitions.push({
                rrLineId: updated.id.toString(),
                rrLineNo: line.rrLineNo,
                itemCode: line.itemCode,
                qcStatus: line.qcStatus,
              });
            }

            if (firstMissingSerials) {
              serialsMissingTransitions.push({
                rrLineId: updated.id.toString(),
                rrLineNo: line.rrLineNo,
                itemCode: line.itemCode,
              });
            }

            // IFS marks the line Cancelled → auto-void every live tag for it
            // (flow cell 536). Idempotent: already-voided tags are skipped by
            // the isVoided=false filter, so repeat polls only report the ones
            // actually voided in this run.
            if (isIfsCancelledStatus(line.qcStatus)) {
              const voided = await tx.packetTag.updateMany({
                where: { rrLineId: updated.id, isVoided: false },
                data: {
                  isVoided: true,
                  voidReason: "IFS_CANCELLED",
                  voidedAt: new Date(),
                  status: PacketTagStatus.VOIDED,
                },
              });
              if (voided.count > 0) {
                cancelledTransitions.push({
                  rrLineId: updated.id.toString(),
                  rrLineNo: line.rrLineNo,
                  itemCode: line.itemCode,
                  voidedTagCount: voided.count,
                });
              }
            }

            if (line.qcStatus === fetchReadyQcStatus && prev?.qcStatus !== fetchReadyQcStatus) {
              fetchReadyLines += 1;
              emitIfsEvent(IfsEventType.RR_LINE_FETCH_READY, {
                rrLineId: updated.id.toString(),
                gateEntryNo,
                rrLineNo: line.rrLineNo,
                itemCode: line.itemCode,
                qcStatus: line.qcStatus,
              });
            }
          }

          // Locations must be upserted before items: ItemMaster.locationNo is a
          // FK into ItemLocation, so referenced rows have to exist first.
          for (const loc of payload.locations) {
            await tx.itemLocation.upsert({
              where: { locationNo: loc.locationNo },
              update: {
                warehouse: loc.warehouse,
                bayNo: loc.bayNo,
                rowNo: loc.rowNo,
                tierNo: loc.tierNo,
                binNo: loc.binNo,
                locationName: loc.locationName,
                cachedAt: new Date(),
              },
              create: loc,
            });
          }

          for (const item of payload.items) {
            await tx.itemMaster.upsert({
              where: { itemCode: item.itemCode },
              update: {
                description: item.description ?? null,
                stockingUom: item.stockingUom ?? null,
                vendorUom: item.vendorUom ?? null,
                countingMethod: item.countingMethod ?? null,
                unitWeightG: item.unitWeightG ?? null,
                weightNet: item.weightNet ?? null,
                assetClass: item.assetClass ?? null,
                isSerialized: item.isSerialized,
                locationNo: item.locationNo ?? null,
                cachedAt: new Date(),
              },
              create: {
                itemCode: item.itemCode,
                description: item.description ?? null,
                stockingUom: item.stockingUom ?? null,
                vendorUom: item.vendorUom ?? null,
                countingMethod: item.countingMethod ?? null,
                unitWeightG: item.unitWeightG ?? null,
                weightNet: item.weightNet ?? null,
                assetClass: item.assetClass ?? null,
                isSerialized: item.isSerialized,
                locationNo: item.locationNo ?? null,
              },
            });
          }

          // Serialized units (INVENTORY_PART_LOCATION.SERIAL_NO mirror). Idempotent via
          // the [itemCode, serialNo] unique key; must run after ItemMaster
          // upserts because Serial.itemCode is an FK into ItemMaster.
          for (const serial of payload.serials) {
            await tx.serial.upsert({
              where: {
                itemCode_serialNo: { itemCode: serial.itemCode, serialNo: serial.serialNo },
              },
              update: {},
              create: { itemCode: serial.itemCode, serialNo: serial.serialNo },
            });
          }

          await syncStorageHierarchy(payload.locations, tx);
        });
      }
    } catch (err) {
      logger.error({ err, gateEntryNo }, "ifs:sync_failed");
      await writeAudit(undefined, {
        action: AuditAction.IFS_SYNC_FAILED,
        resource: AuditResource.SYNC_LOG,
        resourceId: gateEntryNo,
        result: AuditResult.FAILURE,
        meta: { gateEntryNo, reason: err instanceof Error ? err.message : String(err) },
      });
      await prisma.ifsGateEntrySyncState.upsert({
        where: { gateEntryNo },
        update: {
          status: IFS_GATE_ENTRY_SYNC_STATE.FAILED,
          lastError: err instanceof Error ? err.message : String(err),
        },
        create: {
          gateEntryNo,
          status: IFS_GATE_ENTRY_SYNC_STATE.FAILED,
          lastError: err instanceof Error ? err.message : String(err),
        },
      });
      throw new IfsSyncError(
        gateEntryNo,
        err instanceof Error ? err.message : "IFS synchronization failed",
        err,
      );
    }

    // Post-commit effects for lines that newly became Rejected. Kept outside
    // the transaction so a rollback can never leave a stale alert behind.
    for (const t of rejectedTransitions) {
      emitIfsEvent(IfsEventType.RR_LINE_REJECTED, {
        rrLineId: t.rrLineId,
        gateEntryNo,
        rrLineNo: t.rrLineNo,
        itemCode: t.itemCode,
        qcStatus: t.qcStatus,
      });
      await eventLogger.log({
        ref: `${gateEntryNo}/${t.rrLineNo}`,
        eventType: IfsEventType.RR_LINE_REJECTED,
        phase: "FETCH_QC",
        payload: { itemCode: t.itemCode, qcStatus: t.qcStatus },
      });
      await alertsService.raise({
        type: IfsEventType.RR_LINE_REJECTED,
        severity: AlertSeverity.CRITICAL,
        message: `IFS RR line ${gateEntryNo}/${t.rrLineNo} (${t.itemCode}) is REJECTED — permanently disabled in SITS`,
        recipientRoles: [ROLES.ADMIN],
        sourceFn: "ifs.fetch",
        ref: `${gateEntryNo}/${t.rrLineNo}`,
        meta: { itemCode: t.itemCode, rrLineNo: t.rrLineNo, gateEntryNo },
      });
    }

    // Post-commit effects for lines cancelled by IFS (tags auto-voided).
    for (const t of cancelledTransitions) {
      emitIfsEvent(IfsEventType.GATE_ENTRY_LINE_CANCELLED, {
        rrLineId: t.rrLineId,
        gateEntryNo,
        rrLineNo: t.rrLineNo,
        itemCode: t.itemCode,
        voidedTagCount: t.voidedTagCount,
      });
      await eventLogger.log({
        ref: `${gateEntryNo}/${t.rrLineNo}`,
        eventType: IfsEventType.GATE_ENTRY_LINE_CANCELLED,
        phase: "FETCH_QC",
        payload: { itemCode: t.itemCode, voidedTagCount: t.voidedTagCount },
      });
      await alertsService.raise({
        type: IfsEventType.GATE_ENTRY_LINE_CANCELLED,
        severity: AlertSeverity.WARNING,
        message: `IFS RR line ${gateEntryNo}/${t.rrLineNo} (${t.itemCode}) is CANCELLED — ${t.voidedTagCount} tag(s) auto-voided`,
        recipientRoles: [ROLES.ADMIN],
        sourceFn: "ifs.fetch",
        ref: `${gateEntryNo}/${t.rrLineNo}`,
        meta: {
          itemCode: t.itemCode,
          rrLineNo: t.rrLineNo,
          gateEntryNo,
          voidedTagCount: t.voidedTagCount,
        },
      });
    }

    // Post-commit effects for serialized lines found without serial numbers.
    for (const t of serialsMissingTransitions) {
      emitIfsEvent(IfsEventType.RR_LINE_SERIALS_MISSING, {
        rrLineId: t.rrLineId,
        gateEntryNo,
        rrLineNo: t.rrLineNo,
        itemCode: t.itemCode,
      });
      await eventLogger.log({
        ref: `${gateEntryNo}/${t.rrLineNo}`,
        eventType: IfsEventType.RR_LINE_SERIALS_MISSING,
        phase: "FETCH_QC",
        payload: { itemCode: t.itemCode, serialCount: 0 },
      });
      await alertsService.raise({
        type: IfsEventType.RR_LINE_SERIALS_MISSING,
        severity: AlertSeverity.WARNING,
        message: `IFS RR line ${gateEntryNo}/${t.rrLineNo} (${t.itemCode}) is serialized but has no serials in IFS NOTE_TEXT — tagging blocked`,
        recipientRoles: [ROLES.ADMIN],
        sourceFn: "ifs.fetch",
        ref: `${gateEntryNo}/${t.rrLineNo}`,
        meta: { itemCode: t.itemCode, rrLineNo: t.rrLineNo, gateEntryNo },
      });
    }

    await prisma.ifsGateEntrySyncState.upsert({
      where: { gateEntryNo },
      update: {
        status: IFS_GATE_ENTRY_SYNC_STATE.SYNCED,
        lastSyncedAt: new Date(),
        lastError: null,
      },
      create: {
        gateEntryNo,
        status: IFS_GATE_ENTRY_SYNC_STATE.SYNCED,
        lastSyncedAt: new Date(),
      },
    });

    emitIfsEvent(IfsEventType.GATE_ENTRY_SYNCED, {
      gateEntryNo,
      state,
      linesCreated,
      linesUpdated,
      flaggedLines: payload.flaggedLineCount,
      fetchReadyLines,
    });
    await eventLogger.log({
      ref: gateEntryNo,
      eventType: GATE_ENTRY_SYNCED_EVENTS[state],
      phase: "FETCH",
      payload: { state, linesCreated, linesUpdated, flaggedLines: payload.flaggedLineCount },
    });

    return {
      gateEntryNo,
      state,
      rrId: (existing?.id ?? BigInt(0)).toString(),
      linesCreated,
      linesUpdated,
      flaggedLines: payload.flaggedLineCount,
      fetchReadyLines,
    };
  },
};
