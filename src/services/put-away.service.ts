import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { prisma } from "../config/clients.js";
import { EVENT_TYPES } from "../constants/event-types.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { PacketTagStatus } from "../enums/status.enum.js";
import { eventLogger } from "../helpers/event-logger.helper.js";

type Actor = { userId: string; email?: string };

export interface PutAwaySyncItem {
  packetTagEpc: string;
  binRfidEpc: string;
  ifsLocationNo?: string;
  warehouse?: string;
  binNo?: string;
  confirmedAt?: string;
}

interface PutAwaySyncResult {
  epc: string;
  status: string;
  binRfidEpc?: string;
}

export const putAwayService = {
  /** Handheld syncs offline confirmations after re-dock */
  syncFromHandheld: async (
    items: PutAwaySyncItem[],
    deviceId: string,
    actor: Actor,
    auditCtx?: AuditContext,
  ) => {
    const results: PutAwaySyncResult[] = [];
    for (const item of items) {
      const tag = await prisma.packetTag.findUnique({
        where: { epc: item.packetTagEpc },
      });
      if (!tag) {
        results.push({ epc: item.packetTagEpc, status: "TAG_NOT_FOUND" });
        continue;
      }

      await prisma.storageConfirmation.create({
        data: {
          packetTagId: tag.id,
          binRfidEpc: item.binRfidEpc,
          ifsLocationNo: item.ifsLocationNo,
          warehouse: item.warehouse,
          binNo: item.binNo,
          confirmedBy: actor.userId,
          confirmedAt: item.confirmedAt ? new Date(item.confirmedAt) : new Date(),
          syncedFromDevice: deviceId,
        },
      });

      await prisma.packetTag.update({
        where: { id: tag.id },
        data: { status: PacketTagStatus.STORED },
      });

      await eventLogger.log({
        ref: tag.epc,
        eventType: EVENT_TYPES.PUT_AWAY_SYNCED,
        phase: "9-PutAway",
        device: deviceId,
        appUser: actor.userId,
        payload: item as unknown as Record<string, unknown>,
      });

      results.push({
        epc: item.packetTagEpc,
        status: PacketTagStatus.STORED,
        binRfidEpc: item.binRfidEpc,
      });
    }

    await writeAudit(auditCtx, {
      action: AuditAction.PUT_AWAY_SYNC,
      resource: AuditResource.STORAGE_CONFIRMATION,
      result: AuditResult.SUCCESS,
      meta: { deviceId, itemCount: items.length },
    });

    return {
      syncedCount: results.filter((r) => (r.status as PacketTagStatus) === PacketTagStatus.STORED)
        .length,
      results,
    };
  },
};
