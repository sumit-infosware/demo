import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";

const baselineSelect = {
  id: true,
  packetTagId: true,
  method: true,
  unitWeight: true,
  totalWeight: true,
  baselineCount: true,
  ifsQtyAtCount: true,
  varianceFlag: true,
  varianceAmount: true,
  deviceId: true,
  countedBy: true,
  countedAt: true,
  notes: true,
} as const;

export const baselineRepository = {
  findByPacketTagId: (packetTagId: bigint) =>
    prisma.baseline.findUnique({
      where: { packetTagId },
      select: baselineSelect,
    }),

  create: (data: {
    packetTagId: bigint;
    method: string;
    unitWeight?: Prisma.Decimal;
    totalWeight?: Prisma.Decimal;
    baselineCount: Prisma.Decimal;
    ifsQtyAtCount: Prisma.Decimal;
    varianceFlag: boolean;
    varianceAmount?: Prisma.Decimal;
    deviceId?: string;
    countedBy?: string;
    notes?: string;
  }) =>
    prisma.baseline.create({
      data,
      select: baselineSelect,
    }),

  list: async (filters: {
    method?: string;
    varianceOnly?: boolean;
    skip: number;
    take: number;
  }) => {
    const where: Prisma.BaselineWhereInput = {
      ...(filters.method && { method: filters.method }),
      ...(filters.varianceOnly && { varianceFlag: true }),
    };
    const [items, total] = await Promise.all([
      prisma.baseline.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: { countedAt: "desc" },
        select: baselineSelect,
      }),
      prisma.baseline.count({ where }),
    ]);
    return { items, total };
  },

  findPacketWithLine: (packetTagId: bigint) =>
    prisma.packetTag.findUnique({
      where: { id: packetTagId },
      select: {
        id: true,
        epc: true,
        status: true,
        itemCode: true,
        qty: true,
        uom: true,
        rrLine: {
          select: {
            id: true,
            rrLineNo: true,
            orderedQty: true,
            stockingUom: true,
          },
        },
      },
    }),
};
