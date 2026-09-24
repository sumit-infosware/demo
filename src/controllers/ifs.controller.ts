import type { NextFunction, Request, Response } from "express";
import { writeAudit } from "../audit/audit.service.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { success } from "../http/ApiResponse.js";
import {
  ifsPollingConfigService,
  type PollingConfigDto,
} from "../ifs/configuration/poll-config.service.js";
import { ifsPolling } from "../ifs/queues/poll.queue.js";
import { manualFetchService } from "../ifs/services/manual-fetch.service.js";
import { ifsPollStateService } from "../ifs/services/poll-state.service.js";
import { syncHistoryService, type SyncState } from "../ifs/services/sync-history.service.js";
import { IFS_POLL_STATE } from "../ifs/enums/ifs-sync-status.enum.js";
import { toAppError } from "../ifs/errors/ifs.errors.js";

/**
 * IFS integration API — manual fetch, polling health/config, stop/restart.
 *
 * Error policy: IfsErrors (connection, query, sync, read-only violation) are
 * normalized to AppError at this boundary (503 connection / 502 query / 422
 * sync) so the global error middleware renders them consistently.
 */

function wrap(fn: (req: Request, res: Response) => Promise<unknown>, failureAction?: AuditAction) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await fn(req, res);
      success(res, result, 200, req.requestId);
    } catch (err) {
      if (failureAction) {
        await writeAudit(req.auditCtx, {
          action: failureAction,
          resource: AuditResource.SYNC_LOG,
          result: AuditResult.FAILURE,
          meta: { reason: err instanceof Error ? err.message : String(err) },
        });
      }
      next(toAppError(err));
    }
  };
}

export const manualFetchAll = wrap(async (_req, _res) => {
  return manualFetchService.fetchAll();
}, AuditAction.IFS_SYNC_FAILED);

export const manualFetchOne = wrap(async (req, _res) => {
  const { gateEntryNo } = req.params as { gateEntryNo: string };
  return manualFetchService.fetchGateEntry(gateEntryNo);
}, AuditAction.IFS_SYNC_FAILED);

export const getSyncHistory = wrap(async (req) => {
  const { page, limit, status } = req.query as {
    page?: number;
    limit?: number;
    status?: SyncState;
  };
  return syncHistoryService.list({ page, limit, status });
});

export const getPollingConfig = wrap(async () => {
  return ifsPollingConfigService.get();
});

export const updatePollingConfig = wrap(async (req) => {
  const actor = req.user;
  const input = req.body as Partial<PollingConfigDto>;
  const updated = await ifsPollingConfigService.update(input, actor?.userId ?? null);
  await ifsPolling.syncRepollScheduler(updated.rePollEnabled, updated.rePollIntervalMs);
  return updated;
});

export const getPollingState = wrap(async () => {
  return ifsPollStateService.get();
});

export const stopPolling = wrap(async (req) => {
  const { reason } = req.body as { reason?: string };
  await ifsPolling.stopPolling(reason ?? "Admin stopped the poller");
  await writeAudit(req.auditCtx, {
    action: AuditAction.IFS_SYNC_STOPPED,
    resource: AuditResource.SYNC_LOG,
    result: AuditResult.SUCCESS,
    meta: { reason: reason ?? "Admin stopped the poller" },
  });
  return { status: IFS_POLL_STATE.STOPPED };
}, AuditAction.IFS_SYNC_FAILED);

export const restartPolling = wrap(async (req) => {
  const actor = req.user;
  await ifsPolling.restartPolling(actor?.userId ?? null);
  return { status: IFS_POLL_STATE.RUNNING };
});
