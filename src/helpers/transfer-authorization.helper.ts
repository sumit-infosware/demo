import { prisma, redis } from "../config/clients.js";
import { logger } from "../config/logger.js";
import { TransferStatus } from "../enums/status.enum.js";

/**
 * Transfer anti-theft authorization (CC-1).
 *
 * An EPC is allowed to leave Transit only while it is associated with a LIVE,
 * ACTIVE transfer in the SITS database. The `tid:{epc}` Redis mapping is a
 * fast-path lineage cache (bounded TTL, cleared on transfer receive) — it is
 * never the source of truth: a stale key must not authorize a transfer whose
 * DB status has moved to a terminal/non-transit state.
 *
 * ACTIVE (may still be travelling and therefore authorized to exit Transit):
 *   - IN_TRANSIT           (created by generateTransfer)
 *   - CREATED              (created but not yet dispatched)
 *   - PARTIAL_RECEIVED     (holding.service.receive path)
 *   - PARTIALLY_RECEIVED   (gate-verify submitHoldingAudit path)
 */
export const ACTIVE_TRANSFER_STATUSES: readonly string[] = [
  TransferStatus.CREATED,
  TransferStatus.IN_TRANSIT,
  TransferStatus.PARTIAL_RECEIVED,
  TransferStatus.PARTIALLY_RECEIVED,
];

export function isActiveTransferStatus(status: string): boolean {
  return ACTIVE_TRANSFER_STATUSES.includes(status);
}

export interface TransitAuthorization {
  transferId: string | null;
  status: "AUTHORIZED" | "UNAUTHORIZED";
}

export async function assessTransitAuthorization(
  epcs: string[],
): Promise<Map<string, TransitAuthorization>> {
  const result = new Map<string, TransitAuthorization>();

  // 1. One batched lineage read. Fail-open: a GET error behaves like a miss.
  const mappings = new Map<string, string>();
  try {
    const keys = epcs.map((e) => `tid:${e}`);
    const values = await redis.mget(...keys);
    keys.forEach((k, i) => {
      const v = values[i];
      if (v !== null && v !== undefined) mappings.set(epcs[i]!, v);
    });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "transfer_auth: redis mget failed (treated as no mapping)",
    );
  }

  // 2. Resolve DB status for every distinct mapped transfer (single query).
  const transferIds = [...new Set(mappings.values())];
  const activeByTransfer = new Map<string, boolean>();
  if (transferIds.length > 0) {
    try {
      const rows = await prisma.transfer.findMany({
        where: { transferId: { in: transferIds } },
        select: { transferId: true, status: true },
      });
      for (const row of rows)
        activeByTransfer.set(row.transferId, isActiveTransferStatus(row.status));
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "transfer_auth: transfer status lookup failed (treated as not active)",
      );
    }
  }

  // 3. EPCs without a mapping → DB-only fallback (single query).
  const unmapped = epcs.filter((e) => !mappings.has(e));
  const activeByEpc = new Map<string, string>();
  if (unmapped.length > 0) {
    try {
      const rows = await prisma.transferLine.findMany({
        where: {
          epc: { in: unmapped },
          transfer: { status: { in: [...ACTIVE_TRANSFER_STATUSES] } },
        },
        select: { epc: true, transfer: { select: { transferId: true } } },
        orderBy: { createdAt: "desc" },
      });
      for (const row of rows) {
        if (!activeByEpc.has(row.epc)) activeByEpc.set(row.epc, row.transfer.transferId);
      }
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "transfer_auth: active-transfer fallback lookup failed",
      );
    }
  }

  for (const epc of epcs) {
    const tid = mappings.get(epc);
    const transferId = tid ?? activeByEpc.get(epc) ?? null;
    const active = tid ? (activeByTransfer.get(tid) ?? false) : activeByEpc.has(epc);
    result.set(epc, {
      transferId,
      status: transferId && active ? "AUTHORIZED" : "UNAUTHORIZED",
    });
  }
  return result;
}

export async function clearTransferRedisState(transferId: string, epcs: string[]): Promise<void> {
  try {
    const keys = [
      ...epcs.map((e) => `tid:${e}`),
      `tid_set:${transferId}`,
      `transfer:${transferId}`,
    ];
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), transferId },
      "transfer_auth: redis cleanup failed (best-effort)",
    );
  }
}
