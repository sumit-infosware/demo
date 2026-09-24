import { prisma } from "../../config/clients.js";
import { logger } from "../../config/logger.js";
import { IFS_CONSTANTS } from "../constants/ifs.constants.js";
import { IFS_POLL_STATE, type IfsPollState } from "../enums/ifs-sync-status.enum.js";

/**
 * Persisted polling state (survives application restart — not memory-only).
 * Tracks: status, last successful/failed poll, consecutive failure count,
 * current interval, last error, stop reason, who/when restarted.
 */

export const POLL_STATE_KEY = IFS_CONSTANTS.DEFAULT_STATE_KEY;

export interface PollStateDto {
  status: IfsPollState;
  lastPollStartedAt: Date | null;
  lastSuccessfulPoll: Date | null;
  lastFailedPoll: Date | null;
  consecutiveFailureCount: number;
  currentIntervalMs: number;
  lastError: string | null;
  stopReason: string | null;
  restartedBy: string | null;
  restartedAt: Date | null;
  lastRepollAt: Date | null;
  lastRepollCount: number | null;
  lastRepollError: string | null;
}

async function ensureRow(intervalMs: number): Promise<void> {
  const row = await prisma.ifsSyncState.findUnique({ where: { stateKey: POLL_STATE_KEY } });
  if (!row) {
    await prisma.ifsSyncState.create({
      data: {
        stateKey: POLL_STATE_KEY,
        status: IFS_POLL_STATE.RUNNING,
        currentIntervalMs: intervalMs,
      },
    });
  }
}

export const ifsPollStateService = {
  async get(): Promise<PollStateDto> {
    await ensureRow(300_000);
    const row = await prisma.ifsSyncState.findUnique({ where: { stateKey: POLL_STATE_KEY } });
    if (!row) {
      throw new Error("ifs_sync_state row missing after ensure");
    }
    return {
      status: row.status as IfsPollState,
      lastPollStartedAt: row.lastPollStartedAt,
      lastSuccessfulPoll: row.lastSuccessfulPoll,
      lastFailedPoll: row.lastFailedPoll,
      consecutiveFailureCount: row.consecutiveFailureCount,
      currentIntervalMs: row.currentIntervalMs,
      lastError: row.lastError,
      stopReason: row.stopReason,
      restartedBy: row.restartedBy,
      restartedAt: row.restartedAt,
      lastRepollAt: row.lastRepollAt,
      lastRepollCount: row.lastRepollCount,
      lastRepollError: row.lastRepollError,
    };
  },

  async markStarted(): Promise<void> {
    await ensureRow(300_000);
    await prisma.ifsSyncState.update({
      where: { stateKey: POLL_STATE_KEY },
      data: { lastPollStartedAt: new Date() },
    });
  },

  /**
   * Successful poll: reset failures, restore normal interval.
   */
  async markSuccess(normalIntervalMs: number): Promise<void> {
    const row = await prisma.ifsSyncState.upsert({
      where: { stateKey: POLL_STATE_KEY },
      update: {
        status: IFS_POLL_STATE.RUNNING,
        lastSuccessfulPoll: new Date(),
        consecutiveFailureCount: 0,
        currentIntervalMs: normalIntervalMs,
        lastError: null,
      },
      create: {
        stateKey: POLL_STATE_KEY,
        status: IFS_POLL_STATE.RUNNING,
        lastSuccessfulPoll: new Date(),
        currentIntervalMs: normalIntervalMs,
      },
    });
    logger.info({ id: row.id }, "ifs:poll:success");
  },

  /** Failed poll: increment consecutive failures, compute next interval. */
  async markFailure(error: string, nextIntervalMs: number): Promise<number> {
    await ensureRow(300_000);
    const row = await prisma.ifsSyncState.findUnique({ where: { stateKey: POLL_STATE_KEY } });
    const count = (row?.consecutiveFailureCount ?? 0) + 1;
    await prisma.ifsSyncState.update({
      where: { stateKey: POLL_STATE_KEY },
      data: {
        lastFailedPoll: new Date(),
        consecutiveFailureCount: count,
        currentIntervalMs: nextIntervalMs,
        lastError: error,
        status: IFS_POLL_STATE.FAILED,
      },
    });
    logger.warn({ count, nextIntervalMs }, "ifs:poll:failed");
    return count;
  },

  async markStopped(reason: string): Promise<void> {
    await ensureRow(300_000);
    await prisma.ifsSyncState.update({
      where: { stateKey: POLL_STATE_KEY },
      data: { status: IFS_POLL_STATE.STOPPED, stopReason: reason },
    });
    logger.error({ reason }, "ifs:poll:stopped");
  },

  async markRestarted(restartedBy?: string | null, intervalMs = 300_000): Promise<void> {
    await ensureRow(intervalMs);
    await prisma.ifsSyncState.update({
      where: { stateKey: POLL_STATE_KEY },
      data: {
        status: IFS_POLL_STATE.RUNNING,
        consecutiveFailureCount: 0,
        lastError: null,
        stopReason: null,
        restartedBy: restartedBy ?? null,
        restartedAt: new Date(),
        currentIntervalMs: intervalMs,
      },
    });
    logger.info({ restartedBy }, "ifs:poll:restarted");
  },

  /** Records the outcome of a re-poll pass (flow cell 543). */
  async markRepollDone(count: number, error?: string | null): Promise<void> {
    await prisma.ifsSyncState.upsert({
      where: { stateKey: POLL_STATE_KEY },
      update: {
        lastRepollAt: new Date(),
        lastRepollCount: count,
        lastRepollError: error ?? null,
      },
      create: {
        stateKey: POLL_STATE_KEY,
        status: IFS_POLL_STATE.RUNNING,
        currentIntervalMs: 300_000,
        lastRepollAt: new Date(),
        lastRepollCount: count,
        lastRepollError: error ?? null,
      },
    });
    logger.info({ count, error: error ?? null }, "ifs:repoll:recorded");
  },
};
