import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { redis } from "../config/clients.js";
import { logger } from "../config/logger.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { stringifyJson } from "../helpers/json-serializer.helper.js";
import { masterDataRepository } from "../repositories/master-data.repository.js";
import type { SyncApprovedAlternatesRequest } from "../schemas/master-data.schemas.js";

const TTL_SECONDS = 300;

async function cached<T>(
  key: string,
  loader: () => Promise<T>,
): Promise<{ data: T; source: "redis" | "db" }> {
  try {
    const value = await redis.get(key);
    if (value) return { data: JSON.parse(value) as T, source: "redis" };
  } catch (err) {
    logger.warn({ err, key }, "master_data: redis_get_failed");
  }

  const data = await loader();
  try {
    await redis.set(key, stringifyJson(data), "EX", TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, key }, "master_data: redis_set_failed");
  }
  return { data, source: "db" };
}

export const masterDataService = {
  getApprovedAlternates: (orderedItem?: string) =>
    cached(`master:approved-alternates:${orderedItem ?? "all"}`, () =>
      masterDataRepository.listApprovedAlternates(orderedItem),
    ),

  getLocations: (binId?: string) =>
    cached(`master:locations:${binId ?? "all"}`, () => masterDataRepository.listLocations(binId)),

  /**
   * RF-43: Idempotent full-sync of approved alternates from the authoritative
   * IFS payload, then bust the alternates read cache so subsequent GETs
   * reflect the new state.
   */
  syncApprovedAlternates: async (
    body: SyncApprovedAlternatesRequest,
    auditCtx?: AuditContext,
  ): Promise<{ upserted: number; deactivated: number }> => {
    const result = await masterDataRepository.syncApprovedAlternates(body.items);

    try {
      const keys = await redis.keys("master:approved-alternates:*");
      if (keys.length > 0) await redis.del(...keys);
    } catch (err) {
      logger.warn({ err }, "master_data: alternates_cache_bust_failed");
    }

    await writeAudit(auditCtx, {
      action: AuditAction.MASTER_DATA_ALTERNATES_SYNC,
      resource: AuditResource.APPROVED_ALTERNATE,
      result: AuditResult.SUCCESS,
      meta: { upserted: result.upserted, deactivated: result.deactivated },
    });

    return result;
  },
};
