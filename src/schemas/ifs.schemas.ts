import { z } from "zod";
import { IFS_GATE_ENTRY_SYNC_STATE } from "../ifs/enums/ifs-sync-status.enum.js";

/** POST /ifs/fetch — manual fetch of all current IFS gate entries. */
export const ifsFetchAllSchema = z.object({});

/** POST /ifs/fetch/:gateEntryNo — manual fetch of one gate entry. */
export const ifsFetchOneParamSchema = z.object({
  gateEntryNo: z.string().min(1, "Gate entry number is required"),
});

/**
 * GET /ifs/fetch/history — paginated listing of per-gate-entry sync outcomes
 * (PENDING / SYNCED / FAILED) so the Integration Health UI can render the
 * success and failure log.
 */
export const ifsFetchHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      IFS_GATE_ENTRY_SYNC_STATE.PENDING,
      IFS_GATE_ENTRY_SYNC_STATE.SYNCED,
      IFS_GATE_ENTRY_SYNC_STATE.FAILED,
    ])
    .optional(),
});

export const failureRangeSchema = z
  .object({
    min: z.number().int().min(1),
    max: z.number().int().min(1),
    intervalMs: z.number().int().min(1_000),
    notify: z.boolean().default(false),
  })
  .refine((r) => r.max >= r.min, {
    message: "max must be >= min",
    path: ["max"],
  });

/** PUT /ifs/poll/config — partial update of the polling policy. */
export const ifsPollConfigUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    normalIntervalMs: z.number().int().min(1_000).optional(),
    failureRanges: z.array(failureRangeSchema).min(0).optional(),
    stopThreshold: z.number().int().min(1).optional(),
    batchSize: z.number().int().min(1).max(1000).optional(),
    fetchReadyQcStatus: z.string().min(1).max(50).optional(),
    rePollEnabled: z.boolean().optional(),
    rePollIntervalMs: z.number().int().min(1_000).optional(),
    notifyAdminRoles: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/** POST /ifs/poll/stop — optional human-readable stop reason. */
export const ifsPollStopSchema = z.object({
  reason: z.string().max(500).optional().default("Admin stopped the poller"),
});

/** POST /ifs/poll/restart — the restarted-by identity comes from the JWT, body empty. */
export const ifsPollRestartSchema = z.object({});
