import type { Job } from "bullmq";
import { logger } from "../../config/logger.js";
import { AlertSeverity, AlertType } from "../../enums/alert.enum.js";
import { alertsService } from "../../services/alerts.service.js";
import { ifsPollingConfigService } from "../configuration/poll-config.service.js";
import { emitIfsEvent } from "../realtime/ifs-realtime.js";
import { fetchService } from "../services/fetch.service.js";
import { ifsPollStateService } from "../services/poll-state.service.js";
import { IFS_POLL_STATE } from "../enums/ifs-sync-status.enum.js";
import { listRepollCandidates } from "./repoll.repository.js";

/**
 * Soft secondary poll (flow cell 543): after counting, re-read each gate entry
 * that still has lines awaiting IFS QC every rePollIntervalMs.
 */
export async function repollProcessor(job: Job): Promise<unknown> {
  const state = await ifsPollStateService.get();
  if (state.status === IFS_POLL_STATE.STOPPED) {
    logger.warn({ jobId: job.id }, "ifs:repoll:skipped (poller stopped)");
    return { skipped: true };
  }

  const config = await ifsPollingConfigService.get();
  if (!config.enabled || !config.rePollEnabled) {
    logger.info("ifs:repoll:skipped (re-poll disabled)");
    emitIfsEvent("ifs.repoll.skip", { skipped: true });
    return { skipped: true };
  }

  const candidates = await listRepollCandidates(config.fetchReadyQcStatus, config.batchSize);
  if (candidates.length === 0) {
    await ifsPollStateService.markRepollDone(0);
    emitIfsEvent("ifs.repoll.success", {
      completedAt: new Date().toISOString(),
      gateEntries: 0,
      synced: 0,
      fetchReadyLines: 0,
    });
    return { gateEntries: 0, synced: 0, fetchReadyLines: 0 };
  }

  let synced = 0;
  let fetchReady = 0;
  const errors: string[] = [];
  const missingInIfs: string[] = [];

  for (const candidate of candidates) {
    try {
      const result = await fetchService.syncGateEntry(
        candidate.gateEntryNo,
        config.fetchReadyQcStatus,
      );
      synced += 1;
      fetchReady += result.fetchReadyLines;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isMissingInIfs =
        message.includes("not found in IFS") ||
        (err as { code?: string })?.code === "IFS_SYNC_ERROR";

      if (isMissingInIfs) {
        missingInIfs.push(candidate.gateEntryNo);
        logger.warn(
          { gateEntryNo: candidate.gateEntryNo, message },
          "ifs:repoll:gate_entry_not_in_ifs (skipping)",
        );
      } else {
        errors.push(`${candidate.gateEntryNo}: ${message}`);
        logger.error({ err, gateEntryNo: candidate.gateEntryNo }, "ifs:repoll:gate_entry_failed");
      }
    }
  }

  const allErrors = [...errors, ...missingInIfs.map((ge) => `${ge}: not found in IFS`)];
  const errorString = allErrors.length > 0 ? allErrors.join(" | ") : null;
  await ifsPollStateService.markRepollDone(synced, errorString);

  // ✅ FIX: Only raise system alerts if genuine technical errors occurred (not for missing test data in dev)
  if (errors.length > 0) {
    await alertsService.raise({
      type: AlertType.IFS_REPOLL_FAILED,
      severity: AlertSeverity.WARNING,
      message: `IFS re-poll completed with ${errors.length}/${candidates.length} technical failure(s): ${errors.join(" | ")}.`,
      recipientRoles: config.notifyAdminRoles,
      sourceFn: "ifs.repoll",
    });
  }

  emitIfsEvent(errors.length > 0 ? "ifs.repoll.failed" : "ifs.repoll.success", {
    completedAt: new Date().toISOString(),
    gateEntries: candidates.length,
    synced,
    fetchReadyLines: fetchReady,
    failures: errors.length,
    missingInIfsCount: missingInIfs.length,
  });

  logger.info(
    { gateEntries: candidates.length, synced, fetchReady, missingInIfsCount: missingInIfs.length },
    "ifs:repoll:done",
  );
  return {
    gateEntries: candidates.length,
    synced,
    fetchReady,
    failures: errors.length,
    missingInIfsCount: missingInIfs.length,
  };
}
