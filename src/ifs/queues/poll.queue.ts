import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AlertSeverity } from "../../enums/alert.enum.js";
import { ifsClient } from "../client/ifs-client.js";
import { ifsPollingConfigService } from "../configuration/poll-config.service.js";
import { emitIfsEvent } from "../realtime/ifs-realtime.js";
import { repollProcessor } from "../repoll/repoll.processor.js";
import { ifsPollStateService } from "../services/poll-state.service.js";
import { IFS_POLL_STATE } from "../enums/ifs-sync-status.enum.js";
import { pollProcessor } from "./poll.processor.js";

/**
 * BullMQ scheduler + worker for IFS polling.
 *
 * Architecture:
 *   BullMQ Scheduler → IFS Poll Job → runPollSyncCycle() → IFS repository → SITS PostgreSQL
 *
 * A single repeatable job scheduler exists; its `every` interval is rewritten
 * as the failure policy dictates (normal interval on success, escalating
 * interval on failures, removed entirely on STOP).
 */

export const POLL_QUEUE_NAME = "ifs-polling";
export const POLL_SCHEDULER_ID = "ifs-polling-scheduler";
export const POLL_JOB_NAME = "ifs.poll";

export const REPOLL_SCHEDULER_ID = "ifs-polling-repoll";
export const REPOLL_JOB_NAME = "ifs.repoll";

/** BullMQ requires its own ioredis connection with maxRetriesPerRequest: null. */
function createBullConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
}

let workerInstance: Worker | null = null;
let workerConnection: Redis | null = null;
const queueConnection = createBullConnection();

export const ifsPollingQueue = new Queue(POLL_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 500,
    removeOnFail: 500,
  },
});

async function reschedule(intervalMs: number, immediate = false): Promise<void> {
  const repeat: { every: number; immediately?: boolean } = { every: intervalMs };
  if (immediate) repeat.immediately = true;
  await ifsPollingQueue.upsertJobScheduler(POLL_SCHEDULER_ID, repeat, {
    name: POLL_JOB_NAME,
    data: { trigger: "scheduler" },
  });
  logger.info({ intervalMs, immediate }, "ifs:poll:scheduler_rescheduled");
}

/** Removes the repeatable scheduler (STOP state — only admin can restart). */
async function unschedule(): Promise<void> {
  try {
    await ifsPollingQueue.removeJobScheduler(POLL_SCHEDULER_ID);
  } catch (err) {
    logger.warn({ err }, "ifs:poll:remove_scheduler_failed");
  }
}

/** Arms the soft re-poll scheduler (flow cell 543) on the configured interval. */
async function armRepollScheduler(intervalMs: number): Promise<void> {
  const repeat: { every: number; immediately?: boolean } = { every: intervalMs };
  await ifsPollingQueue.upsertJobScheduler(REPOLL_SCHEDULER_ID, repeat, {
    name: REPOLL_JOB_NAME,
    data: { trigger: "scheduler" },
  });
  logger.info({ intervalMs }, "ifs:repoll:scheduler_armed");
}

/** Removes the re-poll scheduler (disabled / stopped). */
async function cancelRepollScheduler(): Promise<void> {
  try {
    await ifsPollingQueue.removeJobScheduler(REPOLL_SCHEDULER_ID);
  } catch (err) {
    logger.warn({ err }, "ifs:repoll:remove_scheduler_failed");
  }
}

export const ifsPolling = {
  /** Boot-time: init IFS client, start worker, (re)arm scheduler unless stopped. */
  async initialize(): Promise<void> {
    ifsClient.init();
    const config = await ifsPollingConfigService.get();
    const state = await ifsPollStateService.get();
    logger.info({ status: state.status, enabled: config.enabled }, "ifs:poll:initialize");

    this.startWorker();

    // Respect persisted state: a stopped poller stays stopped until an Admin restarts it.
    // Boot arms the scheduler on the normal interval (no immediate run) — an
    // Admin-triggered restart below schedules an immediate first poll.
    if (config.enabled && state.status !== IFS_POLL_STATE.STOPPED) {
      await reschedule(state.currentIntervalMs || config.normalIntervalMs, false);
      if (config.rePollEnabled) {
        await armRepollScheduler(config.rePollIntervalMs);
      }
    } else {
      logger.info("ifs:poll:not_scheduling (disabled or stopped)");
    }
  },

  startWorker(): void {
    if (workerInstance) return;
    workerConnection = createBullConnection();
    workerInstance = new Worker(
      POLL_QUEUE_NAME,
      (job) => {
        if (job.name === REPOLL_JOB_NAME) return repollProcessor(job);
        return pollProcessor(job);
      },
      {
        connection: workerConnection,
        concurrency: 1,
        lockDuration: 60_000,
      },
    );
    workerInstance.on("failed", (job, err) => {
      logger.warn({ jobId: job?.id, err }, "ifs:poll:job_failed");
    });
    workerInstance.on("error", (err) => {
      logger.error({ err }, "ifs:poll:worker_error");
    });
    logger.info("ifs:poll:worker_started");
  },

  /** Manual admin action: start/restart the poller. */
  async restartPolling(restartedBy?: string | null): Promise<void> {
    const config = await ifsPollingConfigService.get();
    await ifsPollStateService.markRestarted(restartedBy ?? null, config.normalIntervalMs);
    await reschedule(config.normalIntervalMs, true);
    if (config.rePollEnabled) {
      await armRepollScheduler(config.rePollIntervalMs);
    }
    emitIfsEvent("poll.restarted", { restartedBy: restartedBy ?? null, restartedAt: new Date() });
    logger.info({ restartedBy }, "ifs:poll:restarted");
  },

  /** Manual admin action: stop the poller (only restartPolling brings it back). */
  async stopPolling(reason: string): Promise<void> {
    await unschedule();
    await cancelRepollScheduler();
    await ifsPollStateService.markStopped(reason);
    emitIfsEvent("poll.stopped", { reason, stoppedAt: new Date() });
    logger.warn({ reason }, "ifs:poll:stopped");
  },

  /**
   * Re-arms (or cancels) the re-poll scheduler after a config change, unless
   * the poller is stopped — a stopped poller stays stopped until restarted.
   */
  async syncRepollScheduler(enabled: boolean, intervalMs: number): Promise<void> {
    const state = await ifsPollStateService.get();
    if (enabled && state.status !== IFS_POLL_STATE.STOPPED) {
      await armRepollScheduler(intervalMs);
    } else {
      await cancelRepollScheduler();
    }
  },

  /**
   * Rewrites the scheduler `every` interval (used by the processor to restore
   * the normal interval after a successful cycle that ran on an escalated one).
   */
  async rescheduleInterval(intervalMs: number): Promise<void> {
    await reschedule(intervalMs, false);
  },

  /**
   * Escalation path used by the processor after a failed cycle: increments the
   * consecutive-failure count, applies the policy (escalate interval / notify /
   * stop), and returns the current failure count.
   */
  async onPollFailure(error: string): Promise<number> {
    const config = await ifsPollingConfigService.get();
    const state = await ifsPollStateService.get();
    const nextCount = state.consecutiveFailureCount + 1;
    const decision = ifsPollingConfigService.decide(config, nextCount);

    if (decision.shouldStop) {
      await ifsPollStateService.markFailure(error, config.normalIntervalMs);
      await this.stopPolling(
        `max_consecutive_failures_exceeded (${nextCount}/${config.stopThreshold})`,
      );
      await this.notifyAdmin(
        "poll.stopped",
        `IFS polling stopped because the configured failure threshold was reached (${nextCount}/${config.stopThreshold}): ${error}`,
      );
      emitIfsEvent("poll.failed", {
        consecutiveFailureCount: nextCount,
        error,
        stopThreshold: config.stopThreshold,
      });
      return nextCount;
    }

    await reschedule(decision.nextIntervalMs, false);
    const count = await ifsPollStateService.markFailure(error, decision.nextIntervalMs);
    emitIfsEvent("poll.interval.changed", {
      intervalMs: decision.nextIntervalMs,
      reason: "failure",
      consecutiveFailureCount: count,
    });
    emitIfsEvent("poll.failed", {
      consecutiveFailureCount: count,
      error,
      nextIntervalMs: decision.nextIntervalMs,
    });
    if (decision.notify) {
      const alertType = count > 1 ? "poll.repeated_failure" : "poll.failed";
      const message =
        count > 1
          ? `IFS polling failed repeatedly (${count}/${config.stopThreshold}): ${error}`
          : `IFS polling failed: ${error}`;
      await this.notifyAdmin(alertType, message);
    }
    return count;
  },

  async notifyAdmin(event: string, message: string): Promise<void> {
    const { alertsService } = await import("../../services/alerts.service.js");
    const config = await ifsPollingConfigService.get();
    const severity =
      event === "poll.stopped"
        ? AlertSeverity.CRITICAL
        : event === "poll.recovered"
          ? AlertSeverity.INFO
          : AlertSeverity.WARNING;
    await alertsService.raise({
      type: event,
      severity,
      message,
      recipientRoles: config.notifyAdminRoles,
      sourceFn: "ifs.polling",
    });
  },

  async shutdown(): Promise<void> {
    if (workerInstance) {
      await workerInstance.close();
      workerInstance = null;
    }
    await ifsPollingQueue.close();
    if (workerConnection) {
      await workerConnection.quit().catch(() => undefined);
      workerConnection = null;
    }
    await queueConnection.quit().catch(() => undefined);
  },
};
