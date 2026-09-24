import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";
import { logger } from "../config/logger.js";
import type { ItemLocationSyncInput } from "../ifs/mappers/fetch.mapper.js";
import type { SyncHierarchyStorageDto } from "../types/asset-transfer.types.js";

/**
 * Storage hierarchy — SITS-owned physical warehouse layout
 * (Warehouse → Bay → Row → Tier → Bin).
 *
 * The hierarchy is seeded by prisma/seed-sits.ts. These helpers keep it in
 * lock-step with the IFS location master (INVENTORY_PART_LOCATION) as polled
 * gate entries arrive: each IFS row is decomposed onto the existing chain
 * (upsert by the compound unique keys), creating missing branches when needed.
 *
 * tierRfid/binRfid are non-nullable, so branches created from IFS data get a
 * deterministic code-derived RFID on create; existing RFIDs (from the seed or
 * from registerRfidOnBin) are never overwritten. Physical tag registration is
 * done through registerRfidOnBin / unregisterRfid.
 */

async function upsertChild(
  tx: Prisma.TransactionClient,
  parentId: number | null,
  code: string | null,
  parentField: "warehouseId" | "bayId" | "rowId" | "tierId",
  model: "bay" | "row" | "tier" | "bin",
  rfidField: "tierRfid" | "binRfid" | null,
  rfidValue: string | null,
  name: string | null,
): Promise<{ id: number } | null> {
  if (parentId === null || code === null || code.trim() === "") return null;
  const clean = code.trim();
  const where = { [parentField]: parentId, code: clean } as const;

  const child = await (
    tx[model] as unknown as {
      findFirst: (args: { where: unknown; orderBy?: unknown }) => Promise<{ id: number } | null>;
      update: (args: { where: { id: number }; data: unknown }) => Promise<{ id: number }>;
      create: (args: { data: unknown }) => Promise<{ id: number }>;
    }
  ).findFirst({ where });
  if (child) {
    if (name?.trim()) {
      return (
        tx[model] as unknown as {
          update: (args: { where: { id: number }; data: unknown }) => Promise<{ id: number }>;
        }
      ).update({ where: { id: child.id }, data: { name: name.trim() } });
    }
    return child;
  }

  return (
    tx[model] as unknown as {
      create: (args: { data: unknown }) => Promise<{ id: number }>;
    }
  ).create({
    data: {
      [parentField]: parentId,
      code: clean,
      ...(rfidField && rfidValue ? { [rfidField]: rfidValue } : {}),
      ...(name?.trim() ? { name: name.trim() } : {}),
    },
  });
}

/** Upserts the full warehouse → bay → row → tier → bin chain for one IFS row. */
async function syncLocation(
  tx: Prisma.TransactionClient,
  loc: ItemLocationSyncInput,
): Promise<void> {
  if (loc.warehouse === null || loc.warehouse.trim() === "") return;
  const warehouseCode = loc.warehouse.trim();

  let warehouse = await tx.warehouse.findUnique({ where: { code: warehouseCode } });
  if (!warehouse) {
    warehouse = await tx.warehouse.create({
      data: { code: warehouseCode, name: loc.locationName?.trim() || null },
    });
  } else if (loc.locationName?.trim()) {
    await tx.warehouse.update({
      where: { id: warehouse.id },
      data: { name: loc.locationName.trim() },
    });
  }

  const bay = await upsertChild(
    tx,
    warehouse.id,
    loc.bayNo,
    "warehouseId",
    "bay",
    null,
    null,
    null,
  );
  if (!bay) return;

  const row = await upsertChild(tx, bay.id, loc.rowNo, "bayId", "row", null, null, null);
  if (!row) return;

  const tierRfid = `TIER-${warehouseCode}-${loc.bayNo}-${loc.rowNo}-${loc.tierNo}`;
  const tier = await upsertChild(
    tx,
    row.id,
    loc.tierNo,
    "rowId",
    "tier",
    "tierRfid",
    tierRfid,
    loc.locationName ?? null,
  );
  if (!tier) return;

  const binRfid = `${tierRfid}-${loc.binNo}`;
  await upsertChild(
    tx,
    tier.id,
    loc.binNo,
    "tierId",
    "bin",
    "binRfid",
    binRfid,
    loc.locationName ?? null,
  );
}

/**
 * Syncs a set of IFS location rows into the storage hierarchy. Runs inside the
 * caller's transaction when `tx` is provided, otherwise its own transaction.
 */
export async function syncStorageHierarchy(
  locations: ItemLocationSyncInput[],
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (locations.length === 0) return;
  const client: Prisma.TransactionClient = tx ?? prisma;

  for (const loc of locations) {
    try {
      await syncLocation(client, loc);
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err), locationNo: loc.locationNo },
        "storage_hierarchy: sync_error",
      );
      throw err;
    }
  }
}

/**
 * Registers an RFID tag against a hierarchical Bin by its IFS bin code.
 * Returns true when the bin was resolved and its binRfid updated; false when
 * the bin code is unknown to the hierarchy (caller decides how to handle it).
 */
export async function registerRfidOnBin(
  rfid: string,
  binCode: string,
  tx?: Prisma.TransactionClient,
): Promise<boolean> {
  const client: Prisma.TransactionClient = tx ?? prisma;

  const bin = await client.bin.findFirst({
    where: { code: binCode },
    orderBy: { id: "asc" },
  });
  if (!bin) return false;

  await client.bin.update({ where: { id: bin.id }, data: { binRfid: rfid } });
  return true;
}

/**
 * Releases a physical RFID tag from the hierarchy. binRfid/tierRfid are
 * non-nullable, so the matching tier/bin is instead reset to the deterministic
 * code-derived placeholder used at creation time (see syncLocation).
 */
/**
 * Exports the full storage hierarchy (warehouse → bay → row → tier → bin) as
 * a read-only tree, mapping DB ids to string ids and codes to numbers.
 * Serves GET /api/v1/sync/locations.
 */
export type BinListFilters = {
  warehouse?: string;
  binCode?: string;
  rfid?: string;
  skip?: number;
  take?: number;
};

const binPathSelect = {
  id: true,
  code: true,
  name: true,
  binRfid: true,
  tierId: true,
  tier: {
    select: {
      code: true,
      name: true,
      tierRfid: true,
      row: {
        select: {
          code: true,
          bay: { select: { code: true, warehouse: { select: { code: true } } } },
        },
      },
    },
  },
} as const;

export type HierarchyBinWithPath = Prisma.BinGetPayload<{ select: typeof binPathSelect }>;

function binListWhere(filters: Pick<BinListFilters, "warehouse" | "binCode" | "rfid">) {
  const { warehouse, binCode, rfid } = filters;
  return {
    ...(binCode && { code: { contains: binCode, mode: "insensitive" as const } }),
    ...(warehouse && { tier: { row: { bay: { warehouse: { code: warehouse } } } } }),
    ...(rfid && {
      OR: [
        { binRfid: { contains: rfid, mode: "insensitive" as const } },
        { tier: { tierRfid: { contains: rfid, mode: "insensitive" as const } } },
      ],
    }),
  };
}

/**
 * Filtered, paginated bin list across the storage hierarchy. Shared by the
 * binning location APIs (and any future hierarchy consumers) so the query
 * lives with the hierarchy owner instead of per-domain repositories.
 */
export async function listBins(filters: BinListFilters): Promise<HierarchyBinWithPath[]> {
  const { warehouse, binCode, rfid, skip = 0, take = 20 } = filters;
  return prisma.bin.findMany({
    where: binListWhere({ warehouse, binCode, rfid }),
    select: binPathSelect,
    orderBy: [{ tier: { row: { bay: { warehouse: { code: "asc" } } } } }, { code: "asc" }],
    skip,
    take,
  });
}

/**
 * Count bins matching the same filters as listBins.
 */
export async function countBins(
  filters: Pick<BinListFilters, "warehouse" | "binCode" | "rfid">,
): Promise<number> {
  return prisma.bin.count({ where: binListWhere(filters) });
}

export async function getHierarchyTree(): Promise<SyncHierarchyStorageDto[]> {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { id: "asc" },
    include: {
      bays: {
        orderBy: { id: "asc" },
        include: {
          rows: {
            orderBy: { id: "asc" },
            include: {
              tiers: {
                orderBy: { id: "asc" },
                include: { bins: { orderBy: { id: "asc" } } },
              },
            },
          },
        },
      },
    },
  });

  return warehouses.map((w) => ({
    warehouseId: String(w.id),
    warehouseNo: w.code,
    bays: w.bays.map((bay) => ({
      bayId: String(bay.id),
      bayNo: bay.code,
      rows: bay.rows.map((row) => ({
        rowId: String(row.id),
        rowNo: row.code,
        tiers: row.tiers.map((tier) => ({
          tierId: String(tier.id),
          tierNo: tier.code,
          tierRfid: tier.tierRfid,
          bins: tier.bins.map((bin) => ({
            binId: String(bin.id),
            binNo: bin.code,
            binRfid: bin.binRfid,
          })),
        })),
      })),
    })),
  }));
}

export async function unregisterRfid(rfid: string, tx?: Prisma.TransactionClient): Promise<void> {
  const client: Prisma.TransactionClient = tx ?? prisma;

  const tiers = await client.tier.findMany({
    where: { tierRfid: rfid },
    include: { row: { include: { bay: { include: { warehouse: true } } } } },
  });
  for (const tier of tiers) {
    const placeholder = `TIER-${tier.row.bay.warehouse.code}-${tier.row.bay.code}-${tier.row.code}-${tier.code}`;
    await client.tier.update({ where: { id: tier.id }, data: { tierRfid: placeholder } });
  }

  const bins = await client.bin.findMany({
    where: { binRfid: rfid },
    include: { tier: { include: { row: { include: { bay: { include: { warehouse: true } } } } } } },
  });
  for (const bin of bins) {
    const tierPlaceholder = `TIER-${bin.tier.row.bay.warehouse.code}-${bin.tier.row.bay.code}-${bin.tier.row.code}-${bin.tier.code}`;
    const placeholder = `${tierPlaceholder}-${bin.code}`;
    await client.bin.update({ where: { id: bin.id }, data: { binRfid: placeholder } });
  }
}
