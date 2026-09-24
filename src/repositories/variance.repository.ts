import { prisma } from "../config/clients.js";
import type { Prisma } from "../../prisma/generated/prisma/client.js";

const varianceSelect = {
  id: true,
  context: true,
  ref: true,
  expectedQty: true,
  actualQty: true,
  varianceAmount: true,
  disposition: true,
  raisedBy: true,
  raisedAt: true,
  resolvedBy: true,
  resolvedAt: true,
  notes: true,
} as const;

export const varianceRepository = {
  create: (data: {
    context: string;
    ref: string;
    expectedQty?: Prisma.Decimal;
    actualQty?: Prisma.Decimal;
    varianceAmount?: Prisma.Decimal;
    raisedBy?: string;
    notes?: string;
  }) =>
    prisma.variance.create({
      data,
      select: varianceSelect,
    }),

  findById: (id: bigint) =>
    prisma.variance.findUnique({
      where: { id },
      select: varianceSelect,
    }),

  list: async (filters: { context?: string; disposition?: string; skip: number; take: number }) => {
    const where: Prisma.VarianceWhereInput = {
      ...(filters.context && { context: filters.context }),
      ...(filters.disposition && { disposition: filters.disposition }),
    };
    const [items, total] = await Promise.all([
      prisma.variance.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        orderBy: { raisedAt: "desc" },
        select: varianceSelect,
      }),
      prisma.variance.count({ where }),
    ]);
    return { items, total };
  },

  resolve: (id: bigint, data: { disposition: string; resolvedBy: string; notes?: string }) =>
    prisma.variance.update({
      where: { id },
      data: {
        disposition: data.disposition,
        resolvedBy: data.resolvedBy,
        resolvedAt: new Date(),
        ...(data.notes && { notes: data.notes }),
      },
      select: varianceSelect,
    }),
};
