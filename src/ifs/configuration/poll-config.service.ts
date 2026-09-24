import type { Prisma } from "../../../prisma/generated/prisma/client.js";
import { prisma } from "../../config/clients.js";
import { logger } from "../../config/logger.js";
import { ROLES } from "../../constants/roles.js";
import { IFS_CONSTANTS } from "../constants/ifs.constants.js";

/**
 * Admin-configurable polling policy (persisted in SITS — no code deployment).
 *
 * Defaults implement the required policy table:
 *   failures 0     → normal interval (5 min), no notify
 *   failures 1-2   → 5 min + notify
 *   failures 3-4   → 20 min + notify
 *   failures 5+    → STOP + notify  (stopThreshold)
 *
 * Admin can change normal interval, failure ranges, notification behavior and
 * the stop threshold at runtime via PUT /ifs/poll/config.
 */

export interface FailureRange {
  min: number;
  max: number;
  intervalMs: number;
  notify: boolean;
}

export interface PollingConfigDto {
  enabled: boolean;
  normalIntervalMs: number;
  failureRanges: FailureRange[];
  stopThreshold: number;
  batchSize: number;
  fetchReadyQcStatus: string;
  rePollEnabled: boolean;
  rePollIntervalMs: number;
  notifyAdminRoles: string[];
}

export interface PollingDecision {
  nextIntervalMs: number;
  shouldStop: boolean;
  notify: boolean;
}

export const DEFAULT_POLLING_CONFIG: PollingConfigDto = {
  enabled: true,
  normalIntervalMs: IFS_CONSTANTS.DEFAULT_NORMAL_INTERVAL_MS, // 5 min
  failureRanges: [
    { min: 1, max: 2, intervalMs: 300_000, notify: true },
    { min: 3, max: 4, intervalMs: 1_200_000, notify: true },
  ],
  stopThreshold: IFS_CONSTANTS.DEFAULT_STOP_THRESHOLD,
  batchSize: IFS_CONSTANTS.DEFAULT_BATCH_SIZE,
  fetchReadyQcStatus: IFS_CONSTANTS.DEFAULT_FETCH_READY_QC_STATUS,
  rePollEnabled: true,
  rePollIntervalMs: IFS_CONSTANTS.DEFAULT_REPOLL_INTERVAL_MS, // 5 min (flow cell 543 — re-poll until Inspected)
  notifyAdminRoles: [ROLES.ADMIN],
};

const CONFIG_KEY = IFS_CONSTANTS.DEFAULT_CONFIG_KEY;

function parseJsonArray<T>(value: Prisma.JsonValue | null | undefined, fallback: T[]): T[] {
  if (!Array.isArray(value)) return fallback;
  return value as T[];
}

function parseStringArray(
  value: Prisma.JsonValue | null | undefined,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((v): v is string => typeof v === "string");
}

export const ifsPollingConfigService = {
  /** For tests/reset: recreate the default row. */
  resetToDefaults: async (updatedBy?: string | null): Promise<void> => {
    await prisma.ifsPollingConfig.upsert({
      where: { configKey: CONFIG_KEY },
      update: {
        enabled: DEFAULT_POLLING_CONFIG.enabled,
        normalIntervalMs: DEFAULT_POLLING_CONFIG.normalIntervalMs,
        failureRanges: DEFAULT_POLLING_CONFIG.failureRanges as unknown as Prisma.InputJsonValue,
        stopThreshold: DEFAULT_POLLING_CONFIG.stopThreshold,
        batchSize: DEFAULT_POLLING_CONFIG.batchSize,
        fetchReadyQcStatus: DEFAULT_POLLING_CONFIG.fetchReadyQcStatus,
        rePollEnabled: DEFAULT_POLLING_CONFIG.rePollEnabled,
        rePollIntervalMs: DEFAULT_POLLING_CONFIG.rePollIntervalMs,
        notifyAdminRoles: DEFAULT_POLLING_CONFIG.notifyAdminRoles,
        updatedBy: updatedBy ?? null,
      },
      create: {
        configKey: CONFIG_KEY,
        enabled: DEFAULT_POLLING_CONFIG.enabled,
        normalIntervalMs: DEFAULT_POLLING_CONFIG.normalIntervalMs,
        failureRanges: DEFAULT_POLLING_CONFIG.failureRanges as unknown as Prisma.InputJsonValue,
        stopThreshold: DEFAULT_POLLING_CONFIG.stopThreshold,
        batchSize: DEFAULT_POLLING_CONFIG.batchSize,
        fetchReadyQcStatus: DEFAULT_POLLING_CONFIG.fetchReadyQcStatus,
        rePollEnabled: DEFAULT_POLLING_CONFIG.rePollEnabled,
        rePollIntervalMs: DEFAULT_POLLING_CONFIG.rePollIntervalMs,
        notifyAdminRoles: DEFAULT_POLLING_CONFIG.notifyAdminRoles,
        updatedBy: updatedBy ?? null,
      },
    });
  },

  async get(): Promise<PollingConfigDto> {
    const row = await prisma.ifsPollingConfig.findUnique({ where: { configKey: CONFIG_KEY } });
    if (!row) {
      await this.resetToDefaults();
      return { ...DEFAULT_POLLING_CONFIG };
    }
    return {
      enabled: row.enabled,
      normalIntervalMs: row.normalIntervalMs,
      failureRanges: parseJsonArray<FailureRange>(
        row.failureRanges,
        DEFAULT_POLLING_CONFIG.failureRanges,
      ),
      stopThreshold: row.stopThreshold,
      batchSize: row.batchSize,
      fetchReadyQcStatus: row.fetchReadyQcStatus,
      rePollEnabled: row.rePollEnabled ?? DEFAULT_POLLING_CONFIG.rePollEnabled,
      rePollIntervalMs: row.rePollIntervalMs ?? DEFAULT_POLLING_CONFIG.rePollIntervalMs,
      notifyAdminRoles: parseStringArray(
        row.notifyAdminRoles,
        DEFAULT_POLLING_CONFIG.notifyAdminRoles,
      ),
    };
  },

  async update(
    input: Partial<PollingConfigDto>,
    updatedBy?: string | null,
  ): Promise<PollingConfigDto> {
    const current = await this.get();
    const merged: PollingConfigDto = {
      ...current,
      ...input,
    };
    // Defensive normalization — the API schema also validates this.
    merged.failureRanges = merged.failureRanges
      .filter((r) => r.min >= 1 && r.max >= r.min && r.intervalMs > 0)
      .sort((a, b) => a.min - b.min);
    merged.stopThreshold = Math.max(1, merged.stopThreshold);
    merged.batchSize = Math.max(1, merged.batchSize);
    merged.normalIntervalMs = Math.max(1_000, merged.normalIntervalMs);
    merged.rePollEnabled = Boolean(merged.rePollEnabled);
    merged.rePollIntervalMs = Math.max(1_000, merged.rePollIntervalMs);

    await prisma.ifsPollingConfig.upsert({
      where: { configKey: CONFIG_KEY },
      update: {
        enabled: merged.enabled,
        normalIntervalMs: merged.normalIntervalMs,
        failureRanges: merged.failureRanges as unknown as Prisma.InputJsonValue,
        stopThreshold: merged.stopThreshold,
        batchSize: merged.batchSize,
        fetchReadyQcStatus: merged.fetchReadyQcStatus,
        rePollEnabled: merged.rePollEnabled,
        rePollIntervalMs: merged.rePollIntervalMs,
        notifyAdminRoles: merged.notifyAdminRoles,
        updatedBy: updatedBy ?? null,
      },
      create: {
        configKey: CONFIG_KEY,
        enabled: merged.enabled,
        normalIntervalMs: merged.normalIntervalMs,
        failureRanges: merged.failureRanges as unknown as Prisma.InputJsonValue,
        stopThreshold: merged.stopThreshold,
        batchSize: merged.batchSize,
        fetchReadyQcStatus: merged.fetchReadyQcStatus,
        rePollEnabled: merged.rePollEnabled,
        rePollIntervalMs: merged.rePollIntervalMs,
        notifyAdminRoles: merged.notifyAdminRoles,
        updatedBy: updatedBy ?? null,
      },
    });
    logger.info({ merged }, "ifs:poll:config_updated");
    return this.get();
  },

  /**
   * Computes the next interval + stop decision for a given consecutive-failure
   * count using the persisted policy.
   */
  decide(config: PollingConfigDto, consecutiveFailureCount: number): PollingDecision {
    if (consecutiveFailureCount >= config.stopThreshold) {
      return { nextIntervalMs: config.normalIntervalMs, shouldStop: true, notify: true };
    }
    // Longest matching range wins when ranges overlap.
    const decision = { nextIntervalMs: config.normalIntervalMs, notify: false };
    for (const range of config.failureRanges) {
      if (consecutiveFailureCount >= range.min && consecutiveFailureCount <= range.max) {
        decision.nextIntervalMs = range.intervalMs;
        if (range.notify) decision.notify = true;
      }
    }
    return { ...decision, shouldStop: false };
  },
};
