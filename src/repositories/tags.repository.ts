import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";

/**
 * Data access for the Tag module.
 *
 * All queries use explicit `select` so we control exactly what leaves
 * the DB layer (same convention as user.repository.ts).
 */

export const packetTagSelect = {
  id: true,
  epc: true,
  rrLineId: true,
  packetNo: true,
  batchNo: true,
  colour: true,
  itemCode: true,
  originalItemCode: true,
  qty: true,
  uom: true,
  status: true,
  taggedBy: true,
  taggedAt: true,
  // v2 additions
  tagType: true,
  serialNumber: true,
  barcode: true,
  materialType: true,
  isVoided: true,
  voidReason: true,
  voidedAt: true,
  cocDocLink: true,
  printStatus: true,
  printedAt: true,
  commissionedAt: true,
  readBackEpc: true,
  lineCountId: true,
  colourCategory: true,
} as const;

export const tagRepository = {
  /** Find a tag by id. */
  findById: (id: bigint) =>
    prisma.packetTag.findUnique({
      where: { id },
      select: packetTagSelect,
    }),

  /** Find a tag by EPC (uniqueness check + lookups). */
  findByEpc: (epc: string) =>
    prisma.packetTag.findUnique({
      where: { epc },
      select: packetTagSelect,
    }),

  /** Find many tags by a set of EPCs (RF-21 bulk read at transit exit). */
  findByEpcs: (epcs: string[]) =>
    prisma.packetTag.findMany({
      where: { epc: { in: epcs } },
      select: packetTagSelect,
    }),

  /** All tags for an RR line, ordered by packet number. */
  findByRrLineId: (rrLineId: bigint) =>
    prisma.packetTag.findMany({
      where: { rrLineId },
      orderBy: { packetNo: "asc" },
      select: packetTagSelect,
    }),

  /** Highest packet number already used for a line (for gap-safe numbering). */
  getMaxPacketNo: async (rrLineId: bigint): Promise<number> => {
    const row = await prisma.packetTag.findFirst({
      where: { rrLineId },
      orderBy: { packetNo: "desc" },
      select: { packetNo: true },
    });
    return row?.packetNo ?? 0;
  },

  /** Count tags for a line (used to check "already fully tagged"). */
  countByRrLineId: (rrLineId: bigint) => prisma.packetTag.count({ where: { rrLineId } }),

  /** Create a packet tag. */
  create: (data: {
    epc: string;
    rrLineId: bigint;
    packetNo: number;
    batchNo: string | null;
    colour: string | null;
    itemCode: string;
    originalItemCode: string | null;
    qty: Prisma.Decimal;
    uom: string;
    status: string;
    taggedBy: string | null;
  }) =>
    prisma.packetTag.create({
      data,
      select: packetTagSelect,
    }),

  /** Update a tag's lifecycle status. */
  updateStatus: (id: bigint, status: string) =>
    prisma.packetTag.update({
      where: { id },
      data: { status },
      select: packetTagSelect,
    }),

  /** Paginated list of tags with optional filters. */
  list: async (opts: { rrLineId?: bigint; status?: string; skip: number; take: number }) => {
    const where: Prisma.PacketTagWhereInput = {
      ...(opts.rrLineId !== undefined && { rrLineId: opts.rrLineId }),
      ...(opts.status !== undefined && { status: opts.status }),
    };
    const [items, total] = await Promise.all([
      prisma.packetTag.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy: { taggedAt: "desc" },
        select: packetTagSelect,
      }),
      prisma.packetTag.count({ where }),
    ]);
    return { items, total };
  },

  /** Approved-alternates lookup (RF-46). Reads from local mirror of IFS. */
  findApprovedAlternates: (orderedItemCode: string) =>
    prisma.approvedAlternate.findMany({
      where: { orderedItem: orderedItemCode, isApproved: true },
      select: { alternateItem: true },
    }),

  /** RR line lookup used when creating tags (needs rr no, packaging, etc.). */
  findRrLineForTagging: (id: bigint) =>
    prisma.rrLine.findUnique({
      where: { id },
      select: {
        id: true,
        rrLineNo: true,
        itemCode: true,
        qcStatus: true,
        batchNo: true,
        numPackages: true,
        qtyPerPackage: true,
        orderedQty: true,
        vendorUom: true,
        stockingUom: true,
        rr: { select: { rrNo: true } },
      },
    }),

  /** Item master lookup (RF-05, RF-06). */
  findItemMaster: (itemCode: string) =>
    prisma.itemMaster.findUnique({
      where: { itemCode },
      select: {
        itemCode: true,
        description: true,
        stockingUom: true,
        countingMethod: true,
        uomConvFactor: true,
      },
    }),

  /**
   * IFS key + mirror charge-status lookup for a set of RR lines (RF-22).
   *
   * Returns the local RR identifiers (rrLineNo, rr.rrNo, and the mirror
   * `rr_lines.charge_status`). The identifiers are used to locate the LIVE
   * charge status in IFS; the mirror `chargeStatus` value is retained for
   * historical/reporting use only and is NEVER the approval decision.
   */
  findChargeStatusByRrLineIds: (rrLineIds: bigint[]) =>
    prisma.rrLine.findMany({
      where: { id: { in: rrLineIds } },
      select: {
        id: true,
        rrLineNo: true,
        chargeStatus: true,
        rr: { select: { rrNo: true } },
      },
    }),
};
