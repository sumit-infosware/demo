import { logger } from "../../config/logger.js";
import { ifsPollingConfigService } from "../configuration/poll-config.service.js";
import { emitIfsEvent } from "../realtime/ifs-realtime.js";
import { ifsRepository } from "../repositories/ifs.repository.js";
import { fetchService } from "../services/fetch.service.js";
import { GATE_ENTRY_STATE } from "../types/ifs.types.js";
import { ifsWatermarkService } from "../watermark/watermark.service.js";

/**
 * Runs a single automatic-poll cycle.
 *
 *   last watermark (GATE_ENTRY_DATE + GATE_ENTRY_NO cursor)
 *        ↓
 *   query IFS (GATE_ENTRY_DATE >= watermark, cursor-aware; new entries only)
 *        ↓
 *   sync each gate entry idempotently
 *        ↓
 *   advance watermark ONLY after the whole batch succeeded
 *
 * A failure in ANY gate entry stops the batch: the watermark is not advanced,
 * the failed- and pending entries are re-queried on the next cycle, and no
 * record is ever skipped (records sharing the same GATE_ENTRY_DATE are
 * disambiguated by the GATE_ENTRY_NO cursor).
 */

export interface PollCycleSummary {
  candidates: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  flaggedLines: number;
  fetchReadyLines: number;
}

export class PollCycleAbortedError extends Error {
  readonly gateEntryNo: string;
  constructor(gateEntryNo: string, message: string) {
    super(message);
    this.name = "PollCycleAbortedError";
    this.gateEntryNo = gateEntryNo;
  }
}

export async function runPollSyncCycle(): Promise<PollCycleSummary> {
  const config = await ifsPollingConfigService.get();
  if (!config.enabled) {
    logger.info("ifs:poll:skipped (polling disabled)");
    return {
      candidates: 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      flaggedLines: 0,
      fetchReadyLines: 0,
    };
  }

  const watermark = await ifsWatermarkService.get();
  const headers = await ifsRepository.listGateEntryHeaders({
    fromDate: watermark?.lastSyncedAt,
    lastCursor: watermark?.lastCursor,
    limit: config.batchSize,
  });

  if (headers.length === 0) {
    logger.info("ifs:poll:no_new_entries");
    return {
      candidates: 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      flaggedLines: 0,
      fetchReadyLines: 0,
    };
  }

  const summary: PollCycleSummary = {
    candidates: headers.length,
    newCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    flaggedLines: 0,
    fetchReadyLines: 0,
  };

  let lastProcessed: { gateEntryDate: Date; gateEntryNo: string } | null = null;

  for (const header of headers) {
    try {
      const result = await fetchService.syncGateEntry(
        header.gateEntryNo,
        config.fetchReadyQcStatus,
      );
      if (result.state === GATE_ENTRY_STATE.NEW) summary.newCount += 1;
      else if (result.state === GATE_ENTRY_STATE.UPDATED) summary.updatedCount += 1;
      else summary.unchangedCount += 1;
      summary.flaggedLines += result.flaggedLines;
      summary.fetchReadyLines += result.fetchReadyLines;
      lastProcessed = { gateEntryDate: header.gateEntryDate, gateEntryNo: header.gateEntryNo };
    } catch (err) {
      // Do NOT advance the watermark. Record the error and abort the batch.
      await ifsWatermarkService.recordError(
        err instanceof Error ? err.message : `gate entry ${header.gateEntryNo} failed`,
      );
      logger.error({ err, gateEntryNo: header.gateEntryNo }, "ifs:poll:cycle_aborted");
      throw new PollCycleAbortedError(
        header.gateEntryNo,
        err instanceof Error ? err.message : "gate entry sync failed",
      );
    }
  }

  if (lastProcessed) {
    await ifsWatermarkService.advance(lastProcessed);
  }

  emitIfsEvent("poll.watermark.advanced", {
    date: lastProcessed?.gateEntryDate,
    cursor: lastProcessed?.gateEntryNo,
    candidates: headers.length,
  });

  return summary;
}
