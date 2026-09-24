import { prisma } from "../config/clients.js";
import type { Prisma } from "../../prisma/generated/prisma/client.js";

const countCheckSelect = {
  id: true,
  packetTagId: true,
  baselineId: true,
  actualCount: true,
  baselineCount: true,
  matchesBaseline: true,
  varianceAmount: true,
  withinTolerance: true,
  managerOverride: true,
  overrideNotes: true,
  deviceId: true,
  checkedBy: true,
  checkedAt: true,
} as const;

export const countCheckRepository = {
  create: (data: {
    packetTagId: bigint;
    baselineId: bigint;
    actualCount: Prisma.Decimal;
    baselineCount: Prisma.Decimal;
    matchesBaseline: boolean;
    varianceAmount?: Prisma.Decimal;
    withinTolerance: boolean;
    managerOverride: boolean;
    overrideNotes?: string;
    deviceId?: string;
    checkedBy?: string;
  }) =>
    prisma.countCheck.create({
      data,
      select: countCheckSelect,
    }),

  findByPacketTagId: (packetTagId: bigint) =>
    prisma.countCheck.findFirst({
      where: { packetTagId },
      orderBy: { checkedAt: "desc" },
      select: countCheckSelect,
    }),

  list: async (filters: { mismatchesOnly?: boolean; skip: number; take: number }) => {
    const where: Prisma.CountCheckWhereInput = {
      ...(filters.mismatchesOnly && { matchesBaseline: false }),
    };
    const [items, total] = await Promise.all([
      prisma.countCheck.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: { checkedAt: "desc" },
        select: countCheckSelect,
      }),
      prisma.countCheck.count({ where }),
    ]);
    return { items, total };
  },
};
