import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { logger } from "../config/logger.js";
import { EVENT_TYPES } from "../constants/event-types.js";
import { ROLES } from "../constants/roles.js";
import { scanArrival } from "../controllers/holding.controller.js";
import { AlertSeverity, AlertType } from "../enums/alert.enum.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { TransferStatus } from "../enums/status.enum.js";
import { NotFoundError } from "../errors/errors.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import { clearTransferRedisState } from "../helpers/transfer-authorization.helper.js";
import { holdingRepository } from "../repositories/holding.repository.js";
import { tagRepository } from "../repositories/tags.repository.js";
import type {
  HoldingReceiveInput,
  HoldingReceiveResult,
  HoldingScanInput,
  HoldingScanResult,
  ReconcileAlternateInput,
  ReconcileAlternateResult,
} from "../types/holding.types.js";
import { alertsService } from "./alerts.service.js";
import { varianceService } from "./variance.service.js";

const { findByTransferId, updateLineReception, updateTransferStatus, findPendingTransfers } =
  holdingRepository;

type Actor = { userId: string; email?: string };

export const holdingService = {
  scanArrival: async (
    input: HoldingScanInput,
    _actor: Actor,
    auditCtx?: AuditContext,
  ): Promise<HoldingScanResult> => {
    const transfer = await findByTransferId(input.transferId);
    if (!transfer) throw new NotFoundError(`Transfer ${input.transferId}`);

    const expectedEpcs = new Set(transfer.lines.map((l) => l.epc));
    const scannedSet = new Set(input.scannedEpcs);

    const foundEpcs: string[] = [];
    const missingEpcs: string[] = [];
    const extraEpcs: string[] = [];

    for (const epc of expectedEpcs) {
      if (scannedSet.has(epc)) {
        foundEpcs.push(epc);
      } else {
        missingEpcs.push(epc);
      }
    }

    for (const epc of scannedSet) {
      if (!expectedEpcs.has(epc)) {
        extraEpcs.push(epc);
      }
    }

    await writeAudit(auditCtx, {
      action: AuditAction.HOLDING_SCAN,
      resource: AuditResource.TRANSFER,
      resourceId: input.transferId,
      result: AuditResult.SUCCESS,
      meta: {
        expected: expectedEpcs.size,
        found: foundEpcs.length,
        missing: missingEpcs.length,
        extra: extraEpcs.length,
      },
    });

    return {
      transferId: input.transferId,
      totalExpected: expectedEpcs.size,
      foundEpcs,
      missingEpcs,
      extraEpcs,
      isFullyReceived: missingEpcs.length === 0 && extraEpcs.length === 0,
    };
  },

  receive: async (
    input: HoldingReceiveInput,
    actor: Actor,
    auditCtx?: AuditContext,
  ): Promise<HoldingReceiveResult> => {
    const transfer = await findByTransferId(input.transferId);
    if (!transfer) throw new NotFoundError(`Transfer ${input.transferId}`);

    const receivedMap = new Map<string, number | undefined>();
    input.receivedItems.forEach((item) => receivedMap.set(item.epc, item.receivedQty));

    const receivedEpcs: string[] = [];
    let receivedCount = 0;
    let missingCount = 0;
    let alertRaised = false;

    for (const line of transfer.lines) {
      const isScanned = receivedMap.has(line.epc);
      const expectedQty = Number(line.packetTag.qty.toString());

      if (isScanned) {
        receivedEpcs.push(line.epc);
        const actualQty = receivedMap.get(line.epc) ?? expectedQty;
        const isPartialQty = actualQty < expectedQty;

        await updateLineReception(line.id, {
          isReceived: true,
          isMissing: isPartialQty,
          receivedQty: actualQty,
          missingQty: isPartialQty ? expectedQty - actualQty : 0,
          notes: input.notes,
        });

        receivedCount++;

        await tagRepository.updateStatus(line.packetTagId, "HOLDING_IN");

        await eventLogger.log({
          ref: line.epc,
          eventType: EVENT_TYPES.HOLDING_IN,
          phase: "6-HoldingRecv",
          appUser: actor.userId,
          payload: { transferId: input.transferId, receivedQty: actualQty },
        });

        if (isPartialQty) {
          await varianceService.record({
            context: "HOLDING_RECEIVE",
            ref: line.epc,
            expectedQty,
            actualQty,
            raisedBy: actor.userId,
            notes: `Partial qty inside package ${line.packetTag.packetNo}: expected ${expectedQty}, received ${actualQty}`,
            auditCtx,
          });
        }
      } else {
        await updateLineReception(line.id, {
          isReceived: false,
          isMissing: true,
          receivedQty: 0,
          missingQty: expectedQty,
          notes: input.notes,
        });

        missingCount++;

        await varianceService.record({
          context: "HOLDING_RECEIVE",
          ref: line.epc,
          expectedQty,
          actualQty: 0,
          raisedBy: actor.userId,
          notes: `Package ${line.packetTag.packetNo} (EPC: ${line.epc}) missing at Holding Receive`,
          auditCtx,
        });

        await eventLogger.log({
          ref: line.epc,
          eventType: EVENT_TYPES.HOLDING_MISSING,
          phase: "6-HoldingRecv",
          appUser: actor.userId,
          payload: { transferId: input.transferId, missingPackageNo: line.packetTag.packetNo },
        });
      }
    }

    const isFullyReceived = missingCount === 0;
    const newStatus = isFullyReceived ? TransferStatus.RECEIVED : TransferStatus.PARTIAL_RECEIVED;
    await updateTransferStatus(transfer.id, newStatus);


    // 1. If fully received, clear all EPCs + tid_set + transfer keys.
    // 2. If partially received, only clear the specific EPCs that were received
    //    so remaining in-transit items preserve their fast-path.
    if (isFullyReceived) {
      await clearTransferRedisState(
        input.transferId,
        transfer.lines.map((l) => l.epc),
      );
    } else if (receivedEpcs.length > 0) {
      await clearTransferRedisState(input.transferId, receivedEpcs);
    }

if (receivedEpcs.length > 0) {
  await clearTransferRedisState(input.transferId, receivedEpcs);
}
// For full RECEIVED, clear everything (including tid_set + transfer keys)
if (isFullyReceived) {
  await clearTransferRedisState(input.transferId, transfer.lines.map(l => l.epc));
}



    if (missingCount > 0) {
      await alertsService.raise({
        type: AlertType.HOLDING_SHORTFALL,
        severity: AlertSeverity.WARNING,
        message: `Holding Receive shortfall: ${missingCount} package(s) missing from Transfer ${input.transferId}`,
        recipientRoles: [ROLES.TRANSIT_MANAGER, ROLES.HOLDING_MANAGER],
        sourceFn: "RF-31",
        ref: input.transferId,
        meta: { transferId: input.transferId, missingCount, receivedCount },
      });
      alertRaised = true;
    }

    logger.info(
      {
        requestId: auditCtx?.requestId,
        actorId: actor.userId,
        transferId: input.transferId,
        status: newStatus,
        receivedCount,
        missingCount,
      },
      "Holding receive completed",
    );

    await writeAudit(auditCtx, {
      action: AuditAction.TRANSFER_RECEIVE,
      resource: AuditResource.TRANSFER,
      resourceId: input.transferId,
      result: AuditResult.SUCCESS,
      meta: { status: newStatus, receivedCount, missingCount },
    });

    return {
      transferId: input.transferId,
      status: newStatus,
      receivedCount,
      missingCount,
      alertRaised,
    };
  };

  reconcileAlternate: async (
    input: ReconcileAlternateInput,
    actor: Actor,
    auditCtx?: AuditContext,
  ): Promise<ReconcileAlternateResult> => {
    const packetTagId = BigInt(input.packetTagId);
    const tag = await tagRepository.findById(packetTagId);
    if (!tag) throw new NotFoundError(`Packet tag ${input.packetTagId}`);

    const isMatch = tag.itemCode === input.ifsUpdatedItemCode;

    await eventLogger.log({
      ref: tag.epc,
      eventType: isMatch ? EVENT_TYPES.ALTERNATE_RECONCILED : EVENT_TYPES.ALTERNATE_MISMATCH,
      phase: "6-HoldingRecv",
      appUser: actor.userId,
      payload: {
        orderedX: tag.originalItemCode ?? tag.itemCode,
        taggedY: tag.itemCode,
        ifsY: input.ifsUpdatedItemCode,
        isMatch,
      },
    });

    if (!isMatch) {
      await varianceService.record({
        context: "HOLDING_RECEIVE",
        ref: tag.epc,
        raisedBy: actor.userId,
        notes: `Alternate mismatch: Tagged ${tag.itemCode}, but IFS has ${input.ifsUpdatedItemCode}`,
        auditCtx,
      });
    }

    await writeAudit(auditCtx, {
      action: AuditAction.HOLDING_RECONCILE_ALTERNATE,
      resource: AuditResource.PACKET_TAG,
      resourceId: input.packetTagId,
      result: isMatch ? AuditResult.SUCCESS : AuditResult.FAILURE,
      meta: { taggedItem: tag.itemCode, ifsItem: input.ifsUpdatedItemCode, isMatch },
    });

    return {
      packetTagId: input.packetTagId,
      orderedItemCode: tag.originalItemCode ?? tag.itemCode,
      taggedItemCode: tag.itemCode,
      ifsItemCode: input.ifsUpdatedItemCode,
      isMatch,
      reconciledAt: new Date(),
    };
  },

  listPendingTransfers: async (auditCtx?: AuditContext) => {
    const transfers = await findPendingTransfers();
    await writeAudit(auditCtx, {
      action: AuditAction.HOLDING_LIST_PENDING,
      resource: AuditResource.TRANSFER,
      result: AuditResult.SUCCESS,
    });
    return {
      transfers: transfers.map((t) => ({
        id: t.id.toString(),
        transferId: t.transferId,
        status: t.status,
        createdAt: t.createdAt,
        totalLines: t.lines.length,
        receivedLines: t.lines.filter((l) => l.isReceived).length,
        missingLines: t.lines.filter((l) => l.isMissing).length,
      })),
      total: transfers.length,
    };
  },
};
