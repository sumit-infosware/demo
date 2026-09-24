import type { Prisma } from "../../../prisma/generated/prisma/client.js";
import { prisma } from "../../config/clients.js";
import {
  IFS_GATE_ENTRY_SYNC_STATE,
  type IfsGateEntrySyncState,
} from "../enums/ifs-sync-status.enum.js";

/**
 * Per-gate-entry IFS sync history (SITS-side).
 *
 * Reads `ifs_gate_entry_sync_state`, which fetch.service keeps in sync with
 * the outcome of every gate-entry synchronization (automatic poll or manual
 * fetch). Used by the Integration Health UI to render the success/failure log.
 *
 * Status vocabulary is centralized in src/ifs/enums/ifs-sync-status.enum.js.
 */

/** Per-gate-entry sync outcome (ifs_gate_entry_sync_state.status). */
export type SyncState = IfsGateEntrySyncState;

export interface GateEntrySyncStateDto {
  id: string;
  gateEntryNo: string;
  status: SyncState;
  lastSyncedAt: Date | null;
  lastError: string | null;
  updatedAt: Date;
  createdAt: Date;
}

export interface SyncHistoryQuery {
  page?: number;
  limit?: number;
  status?: SyncState;
}

export interface SyncHistorySummary {
  total: number;
  synced: number;
  failed: number;
  pending: number;
}

export interface SyncHistoryResult {
  gateEntries: GateEntrySyncStateDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: SyncHistorySummary;
}

function toDto(
  row: Awaited<ReturnType<typeof prisma.ifsGateEntrySyncState.findFirstOrThrow>>,
): GateEntrySyncStateDto {
  return {
    id: row.id.toString(),
    gateEntryNo: row.gateEntryNo,
    status: row.status as SyncState,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

export const syncHistoryService = {
  async list(query: SyncHistoryQuery = {}): Promise<SyncHistoryResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const where: Prisma.IfsGateEntrySyncStateWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    const [items, filteredTotal, total, synced, failed, pending] = await Promise.all([
      prisma.ifsGateEntrySyncState.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ifsGateEntrySyncState.count({ where }),
      prisma.ifsGateEntrySyncState.count(),
      prisma.ifsGateEntrySyncState.count({ where: { status: IFS_GATE_ENTRY_SYNC_STATE.SYNCED } }),
      prisma.ifsGateEntrySyncState.count({ where: { status: IFS_GATE_ENTRY_SYNC_STATE.FAILED } }),
      prisma.ifsGateEntrySyncState.count({ where: { status: IFS_GATE_ENTRY_SYNC_STATE.PENDING } }),
    ]);

    return {
      gateEntries: items.map(toDto),
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit),
      },
      summary: {
        total,
        synced,
        failed,
        pending,
      },
    };
  },
};
