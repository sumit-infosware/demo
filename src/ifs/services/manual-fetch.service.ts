import { logger } from "../../config/logger.js";
import { eventLogger } from "../../helpers/event-logger.helper.js";
import { ifsPollingConfigService } from "../configuration/poll-config.service.js";
import { IfsEventType } from "../enums/ifs-event.enum.js";
import { ifsRepository } from "../repositories/ifs.repository.js";
import { fetchService } from "./fetch.service.js";

/**
 * Manual fetch — operator/admin triggered.
 *
 *   - fetchAll():         synchronizes the current IFS Gate Entry data (all headers)
 *   - fetchGateEntry():   synchronizes a single GATE_ENTRY_NO
 *
 * Both delegate to the SAME common synchronization service as the automatic
 * poller (fetchService), so there is no duplicated sync logic. Manual fetch
 * does NOT move the persisted watermark — only the poller advances it.
 */

export interface ManualFetchSummary {
  requested: "all" | "gate-entry";
  gateEntryNo?: string;
  synchronized: number;
  skipped: number;
  failures: Array<{ gateEntryNo: string; error: string }>;
}

export const manualFetchService = {
  async fetchGateEntry(gateEntryNo: string): Promise<ManualFetchSummary> {
    const config = await ifsPollingConfigService.get();
    const result = await fetchService.syncGateEntry(gateEntryNo, config.fetchReadyQcStatus);
    await eventLogger.log({
      ref: gateEntryNo,
      eventType: IfsEventType.MANUAL_FETCH_COMPLETED,
      phase: "FETCH",
      payload: { mode: "gate-entry", state: result.state },
    });
    return {
      requested: "gate-entry",
      gateEntryNo,
      synchronized: 1,
      skipped: 0,
      failures: [],
    };
  },

  async fetchAll(): Promise<ManualFetchSummary> {
    const config = await ifsPollingConfigService.get();
    const headers = await ifsRepository.listGateEntryHeaders({
      fromDate: undefined,
      lastCursor: "",
      limit: 1000,
    });

    const failures: ManualFetchSummary["failures"] = [];
    let synchronized = 0;

    for (const header of headers) {
      try {
        await fetchService.syncGateEntry(header.gateEntryNo, config.fetchReadyQcStatus);
        synchronized += 1;
      } catch (err) {
        failures.push({
          gateEntryNo: header.gateEntryNo,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await eventLogger.log({
      ref: "manual-fetch-all",
      eventType: IfsEventType.MANUAL_FETCH_COMPLETED,
      phase: "FETCH",
      payload: { mode: "all", synchronized, failures: failures.length },
    });
    logger.info({ synchronized, failures: failures.length }, "ifs:manual_fetch:completed");

    return {
      requested: "all",
      synchronized,
      skipped: Math.max(0, headers.length - synchronized),
      failures,
    };
  },
};
