import { prisma } from "../config/clients.js";

export const masterDataRepository = {
  listApprovedAlternates: (orderedItem?: string) => {
    return prisma.approvedAlternate.findMany({
      where: { isApproved: true, ...(orderedItem ? { orderedItem } : {}) },
      orderBy: [{ orderedItem: "asc" }, { alternateItem: "asc" }],
    });
  },

  /**
   * Idempotent full-sync of approved alternates (RF-43). Upserts by the
   * composite unique key (orderedItem, alternateItem) and deactivates any
   * cached rows that are no longer present in the authoritative payload.
   */
  syncApprovedAlternates: async (
    items: Array<{
      orderedItem: string;
      alternateItem: string;
      isApproved?: boolean;
    }>,
  ): Promise<{ upserted: number; deactivated: number }> => {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.approvedAlternate.findMany({
        where: {
          OR: items.map((i) => ({
            orderedItem: i.orderedItem,
            alternateItem: i.alternateItem,
          })),
        },
      });

      const existingMap = new Map(
        existing.map((e) => [`${e.orderedItem}\u0000${e.alternateItem}`, e]),
      );

      let upserted = 0;
      for (const item of items) {
        const wasApproved = existingMap.get(
          `${item.orderedItem}\u0000${item.alternateItem}`,
        )?.isApproved;
        await tx.approvedAlternate.upsert({
          where: {
            orderedItem_alternateItem: {
              orderedItem: item.orderedItem,
              alternateItem: item.alternateItem,
            },
          },
          create: {
            orderedItem: item.orderedItem,
            alternateItem: item.alternateItem,
            isApproved: item.isApproved ?? true,
          },
          update: {
            ...(item.isApproved !== undefined && { isApproved: item.isApproved }),
          },
        });
        if (!wasApproved) upserted++;
      }

      // Deactivate alternates present in DB but not in the authoritative payload
      const deactivated = await tx.approvedAlternate.updateMany({
        where: {
          NOT: {
            OR: items.map((i) => ({ orderedItem: i.orderedItem, alternateItem: i.alternateItem })),
          },
        },
        data: { isApproved: false },
      });

      return {
        upserted,
        deactivated: deactivated.count,
      };
    });
  },

  // ===== RF-43: Sync approved alternates retrieval =====
  /**
   * Listing approved alternates for the external alternates-sync export (RF-43).
   * Alternates are item-level (no warehouse dimensions).
   */
  listApprovedAlternatesForSync: (_warehouse?: string) => {
    return prisma.approvedAlternate.findMany({
      where: { isApproved: true },
      orderBy: [{ orderedItem: "asc" }, { alternateItem: "asc" }],
    });
  },

  listLocations: async (binId?: string) => {
    const warehouses = await prisma.warehouse.findMany({
      where: {
        bays: {
          some: {
            rows: {
              some: {
                tiers: {
                  some: { bins: { some: binId ? { code: binId } : {} } },
                },
              },
            },
          },
        },
      },
      include: {
        bays: {
          orderBy: { code: "asc" },
          include: {
            rows: {
              orderBy: { code: "asc" },
              include: {
                tiers: {
                  orderBy: { code: "asc" },
                  include: { bins: { orderBy: { code: "asc" } } },
                },
              },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    });

    return warehouses.flatMap((warehouse) =>
      warehouse.bays.flatMap((bay) =>
        bay.rows.flatMap((row) =>
          row.tiers.flatMap((tier) =>
            tier.bins
              .filter((bin) => !binId || bin.code === binId)
              .map((bin) => ({
                binId: bin.code,
                positionId: null,
                locationNo: `${warehouse.code}-${bay.code}-${row.code}-${tier.code}-${bin.code}`,
                locationName: bin.name ?? tier.name ?? null,
                warehouse: warehouse.code,
                bayNo: bay.code,
                rowNo: row.code,
                tierNo: tier.code,
                binNo: bin.code,
                description: bin.name ?? tier.name ?? null,
              })),
          ),
        ),
      ),
    );
  },
};
