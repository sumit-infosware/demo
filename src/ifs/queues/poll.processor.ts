import type { Job } from "bullmq";
import { logger } from "../../config/logger.js";
import { ifsPollingConfigService } from "../configuration/poll-config.service.js";
import { emitIfsEvent } from "../realtime/ifs-realtime.js";
import { ifsPollStateService } from "../services/poll-state.service.js";
import { IFS_POLL_STATE } from "../enums/ifs-sync-status.enum.js";
import { runPollSyncCycle } from "../sync/sync-runner.js";
import { ifsPolling } from "./poll.queue.js";

/**
 * BullMQ processor for the IFS poll job.
 *
 * Failure policy (required):
 *   - attempts: 1 (no internal retries — retry scheduling happens via the
 *     escalating BullMQ scheduler interval)
 *   - watchdog-style: status saved to IfsSyncState, persists restart
 *   - consecutive failures escalate interval and (optionally) notify admins
 *   - crossing stopThreshold STOPs the poller — admin must start it again
 *
 * A poll cycle is considered STALE if the previous job is still running —
 * concurrency is 1 and lockDuration covers the longest expected sync, so a
 * stale node won't double-run in the same process. Cross-process: the IFS
 * sync is transactional and watermark-advance is last-writer-wins, so
 * overlapping nodes converge without duplicate RR rows.
 */

export async function pollProcessor(job: Job): Promise<unknown> {
  const state = await ifsPollStateService.get();
  if (state.status === IFS_POLL_STATE.STOPPED) {
    logger.warn({ jobId: job.id }, "ifs:poll:job_skipped (poller stopped)");
    return { skipped: true };
  }

  await ifsPollStateService.markStarted();
  emitIfsEvent("poll.started", { jobId: job.id, startedAt: new Date() });
  logger.info({ jobId: job.id }, "ifs:poll:started");

  try {
    const summary = await runPollSyncCycle();
    const current = await ifsPollingConfigService.get();
    const st = await ifsPollStateService.get();
    const hadFailures = st.consecutiveFailureCount > 0 || st.status === IFS_POLL_STATE.FAILED;
    if (st.currentIntervalMs !== current.normalIntervalMs) {
      await ifsPolling.rescheduleInterval(current.normalIntervalMs);
    }
    await ifsPollStateService.markSuccess(current.normalIntervalMs);
    if (hadFailures) {
      await ifsPolling.notifyAdmin("poll.recovered", "IFS polling recovered successfully");
      emitIfsEvent("poll.recovered", { recoveredAt: new Date() });
    }
    emitIfsEvent("poll.success", { ...summary, completedAt: new Date() });
    logger.info({ ...summary }, "ifs:poll:success");
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ifsPolling.onPollFailure(message); // escalates interval / notifies / stops
    throw err;
  }
}
