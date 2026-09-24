import { prisma } from "../config/clients.js";
import { FETCH_READY_STATUS, SITS_QC_STATUS } from "../ifs/status/ifs-status.js";

const rrLineSelect = {
  id: true,
  rrId: true,
  rrLineNo: true,
  gateEntryNo: true,
  gateEntryLineNo: true,
  receiptNo: true,
  itemCode: true,
  itemDesc: true,
  category: true,
  orderedQty: true,
  receivedQty: true,
  acceptedQty: true,
  vendorUom: true,
  stockingUom: true,
  conversionFactor: true,
  qcStatus: true,
  chargeStatus: true,
  chargesApprovedAt: true,
  batchNo: true,
  numPackages: true,
  qtyPerPackage: true,
  computedTotalQty: true,
  alternateItemCode: true,
  originalItemCode: true,
  fetchedAt: true,

  // 👈 FIXED: Added v2.0 fields so frontend receives them in API response!
  itemType: true,
  isSerialized: true,
  serialNumbers: true,
  materialType: true,
  requiresEngraving: true,
  ownership: true,
  sitsStatus: true,
  ifsRejected: true,
  ifsRejectedAt: true,
  serialsMissingAlerted: true,
  serialsMissingAlertedAt: true,

  rr: {
    select: {
      id: true,
      rrNo: true,
      gateEntryNo: true,
      rrStatus: true,
      rrDate: true,
      vendorName: true,
      vendorNo: true,
    },
  },
  _count: {
    select: { packetTags: true },
  },
} as const;

export const rrRepository = {
  /** Paginated list of RRs with per-line taggability summary. */
  listRrs: async (options: { skip: number; take: number }) => {
    const [items, total] = await Promise.all([
      prisma.rr.findMany({
        skip: options.skip,
        take: options.take,
        orderBy: { rrDate: "desc" },
        include: {
          _count: { select: { lines: true } },
          lines: {
            where: { qcStatus: { in: [FETCH_READY_STATUS, SITS_QC_STATUS.PASSED] } },
            select: { id: true },
          },
        },
      }),
      prisma.rr.count(),
    ]);
    return { items, total };
  },

  findRrById: (id: bigint) =>
    prisma.rr.findUnique({
      where: { id },
      include: {
        lines: { select: rrLineSelect, orderBy: { rrLineNo: "asc" } },
      },
    }),

  findRrLineById: (id: bigint) =>
    prisma.rrLine.findUnique({
      where: { id },
      select: rrLineSelect,
    }),

  listRrLines: (filters: { rrId?: bigint; qcStatus?: string }) =>
    prisma.rrLine.findMany({
      where: {
        ...(filters.rrId !== undefined && { rrId: filters.rrId }),
        ...(filters.qcStatus !== undefined && { qcStatus: filters.qcStatus }),
      },
      select: rrLineSelect,
      orderBy: [{ rrId: "desc" }, { rrLineNo: "asc" }],
    }),
};
