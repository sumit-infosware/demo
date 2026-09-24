import { prisma } from "../../config/clients.js";
import { logger } from "../../config/logger.js";
import { ROLES } from "../../constants/roles.js";
import { AlertSeverity, AlertType } from "../../enums/alert.enum.js";
import { alertsService } from "../../services/alerts.service.js";
import { ifsPollingConfigService } from "../configuration/poll-config.service.js";
import { IFS_WATERMARK_STATUS } from "../enums/ifs-sync-status.enum.js";
import type { IfsWatermarkCursor } from "../types/ifs.types.js";

/**
 * Persisted fetch watermark.
 *
 * Based on IFS GATE_ENTRY_HEADER.GATE_ENTRY_DATE (with a deterministic
 * GATE_ENTRY_NO cursor so records sharing the same date are never
 * skipped). The watermark only advances after the corresponding IFS records
 * have been successfully synchronized — a failed record blocks advancement
 * and is re-queried on the next cycle. Only NEW gate entries are ever picked
 * up; the cursor never moves backwards, so updated entries are not re-synced.
 */
const WATERMARK_RESOURCE = "gate-entry";

export interface IfsWatermarkState {
  lastSyncedAt: Date;
  lastCursor: string;
}

export const ifsWatermarkService = {
  resource: WATERMARK_RESOURCE,

  async get(): Promise<IfsWatermarkState | null> {
    const row = await prisma.ifsSyncWatermark.findUnique({
      where: { resource: WATERMARK_RESOURCE },
    });
    if (!row) return null;
    return { lastSyncedAt: row.lastSyncedAt, lastCursor: row.lastCursor ?? "" };
  },

  /**
   * Advances the watermark to the given (gateEntryDate, gateEntryNo) cursor.
   * Only the poller calls this, and only after a full batch has succeeded.
   */
  async advance(cursor: IfsWatermarkCursor): Promise<void> {
    const recorded = await prisma.ifsSyncWatermark.upsert({
      where: { resource: WATERMARK_RESOURCE },
      update: {
        lastSyncedAt: cursor.gateEntryDate,
        lastCursor: cursor.gateEntryNo,
        status: IFS_WATERMARK_STATUS.HEALTHY,
        lastError: null,
        updatedAt: new Date(),
      },
      create: {
        resource: WATERMARK_RESOURCE,
        lastSyncedAt: cursor.gateEntryDate,
        lastCursor: cursor.gateEntryNo,
        status: IFS_WATERMARK_STATUS.HEALTHY,
      },
    });
    logger.info(
      { date: cursor.gateEntryDate, cursor: cursor.gateEntryNo, id: recorded.id },
      "ifs:watermark:advanced",
    );
  },

  /** Records a failure against the watermark resource (does not advance it) and raises an alert. */
  async recordError(error: string): Promise<void> {
    try {
      const existing = await prisma.ifsSyncWatermark.findUnique({
        where: { resource: WATERMARK_RESOURCE },
      });
      if (existing) {
        await prisma.ifsSyncWatermark.update({
          where: { resource: WATERMARK_RESOURCE },
          data: { status: IFS_WATERMARK_STATUS.DEGRADED, lastError: error, updatedAt: new Date() },
        });
      } else {
        await prisma.ifsSyncWatermark.create({
          data: {
            resource: WATERMARK_RESOURCE,
            lastSyncedAt: new Date(Date.UTC(1970, 0, 1)),
            status: IFS_WATERMARK_STATUS.DEGRADED,
            lastError: error,
          },
        });
      }

      const config = await ifsPollingConfigService.get().catch(() => null);
      await alertsService.raise({
        type: AlertType.IFS_WATERMARK_ERROR,
        severity: AlertSeverity.CRITICAL,
        message: `IFS polling watermark error: ${error}`,
        recipientRoles: config?.notifyAdminRoles ?? [ROLES.ADMIN],
        sourceFn: "ifs.polling",
        ref: WATERMARK_RESOURCE,
        meta: { resource: WATERMARK_RESOURCE, error },
      });
    } catch (err) {
      logger.error({ err }, "ifs:watermark:error_record_failed");
    }
  },
};
