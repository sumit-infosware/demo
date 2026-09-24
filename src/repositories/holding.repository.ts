import { prisma } from "../config/clients.js";
import { TransferStatus } from "../enums/status.enum.js";

const transferWithLinesSelect = {
  id: true,
  transferId: true,
  status: true,
  createdBy: true,
  createdAt: true,
  lines: {
    select: {
      id: true,
      transferId: true,
      packetTagId: true,
      rrLineId: true,
      epc: true,
      isReceived: true,
      receivedAt: true,
      isMissing: true,
      receivedQty: true,
      missingQty: true,
      notes: true,
      packetTag: {
        select: {
          id: true,
          epc: true,
          packetNo: true,
          itemCode: true,
          originalItemCode: true,
          qty: true,
          uom: true,
          status: true,
          batchNo: true,
        },
      },
    },
  },
} as const;

export const holdingRepository = {
  findByTransferId: (transferId: string) =>
    prisma.transfer.findUnique({
      where: { transferId },
      select: transferWithLinesSelect,
    }),

  updateLineReception: (
    lineId: bigint,
    data: {
      isReceived: boolean;
      receivedAt?: Date | null;
      isMissing: boolean;
      receivedQty?: number | null;
      missingQty?: number | null;
      notes?: string | null;
    },
  ) =>
    prisma.transferLine.update({
      where: { id: lineId },
      data: {
        isReceived: data.isReceived,
        receivedAt: data.receivedAt ?? (data.isReceived ? new Date() : null),
        isMissing: data.isMissing,
        ...(data.receivedQty !== undefined && { receivedQty: data.receivedQty }),
        ...(data.missingQty !== undefined && { missingQty: data.missingQty }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    }),

  updateTransferStatus: (id: bigint, status: string) =>
    prisma.transfer.update({
      where: { id },
      data: { status },
      select: { id: true, transferId: true, status: true },
    }),

  findPendingTransfers: () =>
    prisma.transfer.findMany({
      where: {
        status: {
          in: [TransferStatus.CREATED, TransferStatus.IN_TRANSIT, TransferStatus.PARTIAL_RECEIVED],
        },
      },
      orderBy: { createdAt: "desc" },
      select: transferWithLinesSelect,
    }),
};
