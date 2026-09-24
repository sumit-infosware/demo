import { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";

export const lineCountSelect = {
  id: true,
  rrLineId: true,
  method: true,
  numPackages: true,
  qtyPerPackage: true,
  unitWeightG: true,
  totalWeightG: true,
  reelReadingMtr: true,
  pitchMm: true,
  calculatedQty: true,
  operatorEditedQty: true,
  finalCountedQty: true,
  ifsChallanQty: true,
  varianceQty: true,
  varianceFlag: true,
  deviceId: true,
  countedBy: true,
  countedAt: true,
  notes: true,
} as const;

export const lineCountRepository = {
  create: (data: {
    rrLineId: bigint;
    method: string;
    numPackages: number;
    qtyPerPackage: Prisma.Decimal;
    unitWeightG?: Prisma.Decimal;
    totalWeightG?: Prisma.Decimal;
    reelReadingMtr?: Prisma.Decimal;
    pitchMm?: Prisma.Decimal;
    calculatedQty: Prisma.Decimal;
    operatorEditedQty?: Prisma.Decimal;
    finalCountedQty: Prisma.Decimal;
    ifsChallanQty: Prisma.Decimal;
    varianceQty: Prisma.Decimal;
    varianceFlag: boolean;
    deviceId?: string;
    countedBy?: string;
    notes?: string;
  }) => prisma.lineCount.create({ data, select: lineCountSelect }),

  findLatestByRrLineId: (rrLineId: bigint) =>
    prisma.lineCount.findFirst({
      where: { rrLineId },
      orderBy: { countedAt: "desc" },
      select: lineCountSelect,
    }),

  findAllByRrLineId: (rrLineId: bigint) =>
    prisma.lineCount.findMany({
      where: { rrLineId },
      orderBy: { countedAt: "desc" },
      select: lineCountSelect,
    }),

  findRrLineForCounting: (id: bigint) =>
    prisma.rrLine.findUnique({
      where: { id },
      select: {
        id: true,
        rrLineNo: true,
        itemCode: true,
        itemDesc: true,
        orderedQty: true,
        qcStatus: true,
        sitsStatus: true,
        isSerialized: true,
        serialNumbers: true,
        itemType: true,
        vendorUom: true,
        stockingUom: true,
        conversionFactor: true,
        numPackages: true,
        qtyPerPackage: true,
        batchNo: true,
        materialType: true,
        requiresEngraving: true,
        rr: { select: { rrNo: true } },
      },
    }),

  updateRrLinePackaging: (
    rrLineId: bigint,
    data: {
      numPackages: number;
      qtyPerPackage: Prisma.Decimal;
      computedTotalQty: Prisma.Decimal;
      sitsStatus: string;
    },
  ) =>
    prisma.rrLine.update({
      where: { id: rrLineId },
      data,
    }),
};
