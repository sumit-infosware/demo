import { prisma } from "../config/clients.js";

const rrLineSelect = {
  itemDesc: true,
  category: true,
  acceptedQty: true,
  receivedQty: true,
  orderedQty: true,
  stockingUom: true,
  ownership: true,
} as const;

export const assetTransferRepository = {
  listTransfers: async () => {
    const items = await prisma.transfer.findMany({
      orderBy: { createdAt: "desc" },
      select: { transferId: true },
    });
    return items;
  },

  findTransferByBusinessId: (transferId: string) =>
    prisma.transfer.findUnique({
      where: { transferId },
      select: { id: true, transferId: true },
    }),

  findHierarchyBinByCode: (code: string) =>
    prisma.bin.findFirst({
      where: { code },
      orderBy: { id: "asc" },
      include: {
        tier: {
          include: {
            row: {
              include: {
                bay: {
                  include: {
                    warehouse: true,
                  },
                },
              },
            },
          },
        },
      },
    }),

  getTransferItemsWithLocations: async (transferDbId: bigint) => {
    const lines = await prisma.transferLine.findMany({
      where: { transferId: transferDbId },
      orderBy: { id: "asc" },
      select: {
        packetTag: {
          select: { id: true, epc: true, qty: true },
        },
      },
    });

    const packetTagIds = lines
      .map((l) => l.packetTag?.id)
      .filter((id): id is bigint => id !== null && id !== undefined);

    const planLines = packetTagIds.length
      ? await prisma.binningPlanLine.findMany({
          where: { packetTagId: { in: packetTagIds } },
          orderBy: [{ binId: "asc" }, { positionId: "asc" }, { createdAt: "asc" }],
          select: { packetTagId: true, binId: true, positionId: true },
        })
      : [];

    return { lines, planLines };
  },

  findItemLocationByBinNo: (binNo: string) =>
    prisma.itemLocation.findFirst({
      where: { binNo },
      orderBy: { id: "asc" },
      select: { id: true, locationNo: true },
    }),

  findTagByEpc: (epc: string) =>
    prisma.packetTag.findUnique({
      where: { epc },
      select: {
        id: true,
        rrLineId: true,
        epc: true,
        tagType: true,
        packetNo: true,
        status: true,
        serialNumber: true,
        barcode: true,
        qty: true,
        uom: true,
        batchNo: true,
        colour: true,
        materialType: true,
        isVoided: true,
        itemCode: true,
        rrLine: { select: rrLineSelect },
      },
    }),
};
