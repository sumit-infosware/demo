import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { NotFoundError } from "../errors/errors.js";
import { isTaggableQcStatus } from "../ifs/status/ifs-status.js";
import { rrRepository } from "../repositories/rr.repository.js";
import type { RrLineDto, RrListItem, SerialCheckResult } from "../types/rr.types.js";

const { listRrs, findRrById, findRrLineById, listRrLines } = rrRepository;

// Defined an interface for the incoming line object to avoid 'any'
interface RawRrLine {
  id: bigint;
  rrId: bigint;
  gateEntryNo?: string | null;
  rrLineNo: string;
  itemCode: string;
  itemDesc: string | null;
  category: string | null;
  orderedQty: { toString(): string };
  receivedQty: { toString(): string } | null;
  vendorUom: string | null;
  stockingUom: string | null;
  qcStatus: string | null;
  chargeStatus: string | null;
  batchNo: string | null;
  numPackages: number | null;
  qtyPerPackage: { toString(): string } | null;
  fetchedAt: Date;
  rr: {
    rrNo: string;
    gateEntryNo?: string | null;
    vendorName: string | null;
    vendorNo: string | null;
  };
  _count: { packetTags: number };
  itemType: string;
  serialNumbers: string | null;
  isSerialized: boolean;
  materialType: string | null;
  requiresEngraving: boolean;
  isFractionalQty: boolean;
  ifsRejected: boolean;
  ifsRejectedAt: Date | null;
  serialsMissingAlerted: boolean;
  serialsMissingAlertedAt: Date | null;
}

function toRrLineDto(line: RawRrLine): RrLineDto {
  const totalTags = line._count?.packetTags ?? 0;
  const expectedPackets = line.numPackages ?? 1;
  const isTaggable = isTaggableQcStatus(line.qcStatus) && totalTags < expectedPackets;
  const rrNumber = line.rr?.rrNo || line.gateEntryNo || "";

  return {
    id: line.id.toString(),
    rrId: line.rrId.toString(),
    rrNo: rrNumber,
    ifsRrNo: rrNumber,
    gateEntryNo: line.gateEntryNo || rrNumber,
    rrLineNo: line.rrLineNo,
    // vendorName: line.rr.vendorName,
    vendorName: line.rr.vendorName,
    vendorNo: line.rr.vendorNo,
    itemCode: line.itemCode,
    itemDesc: line.itemDesc,
    category: line.category,
    orderedQty: Number(line.orderedQty.toString()),
    receivedQty: line.receivedQty ? Number(line.receivedQty.toString()) : null,
    vendorUom: line.vendorUom,
    stockingUom: line.stockingUom,
    qcStatus: line.qcStatus,
    chargeStatus: line.chargeStatus,
    batchNo: line.batchNo,
    numPackages: line.numPackages,
    qtyPerPackage: line.qtyPerPackage ? Number(line.qtyPerPackage.toString()) : null,
    isTaggable,
    totalTagsCreated: totalTags,
    fetchedAt: line.fetchedAt,
    itemType: line.itemType,
    serialNumbers: line.serialNumbers,
    isSerialized: line.isSerialized,
    materialType: line.materialType,
    requiresEngraving: line.requiresEngraving,
    isFractionalQty: line.isFractionalQty,
    ifsRejected: line.ifsRejected,
    ifsRejectedAt: line.ifsRejectedAt,
    serialsMissingAlerted: line.serialsMissingAlerted,
    serialsMissingAlertedAt: line.serialsMissingAlertedAt,
  };
}

export const rrService = {
  listRrs: async (options: { page: number; limit: number }, auditCtx?: AuditContext) => {
    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.limit);
    const { items, total } = await listRrs({ skip: (page - 1) * limit, take: limit });

    const result = {
      rrs: items.map((r): RrListItem => ({
        id: r.id.toString(),
        rrNo: r.rrNo,
        ifsRrNo: r.rrNo,
        gateEntryNo: r.gateEntryNo ?? r.rrNo,
        // vendorName: r.vendorName,
        vendorNo: r.vendorNo,
        rrStatus: r.rrStatus,
        rrDate: r.rrDate,
        totalLines: r._count.lines,
        taggableLines: r.lines.length,
        fetchedAt: r.fetchedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
    await writeAudit(auditCtx, {
      action: AuditAction.RR_LIST,
      resource: AuditResource.RR,
      result: AuditResult.SUCCESS,
    });
    return result;
  },

  getRrById: async (id: string, auditCtx?: AuditContext) => {
    const rr = await findRrById(BigInt(id));
    if (!rr) throw new NotFoundError("Receiving Report");
    await writeAudit(auditCtx, {
      action: AuditAction.RR_READ,
      resource: AuditResource.RR,
      resourceId: id,
      result: AuditResult.SUCCESS,
    });
    return {
      id: rr.id.toString(),
      rrNo: rr.rrNo,
      ifsRrNo: rr.rrNo,
      gateEntryNo: rr.gateEntryNo ?? rr.rrNo,
      vendorName: rr.vendorName,
      rrStatus: rr.rrStatus,
      rrDate: rr.rrDate,
      fetchedAt: rr.fetchedAt,
      lines: rr.lines.map((line) => toRrLineDto(line as unknown as RawRrLine)),
    };
  },

  getRrLineById: async (id: string, auditCtx?: AuditContext) => {
    const line = await findRrLineById(BigInt(id));
    if (!line) throw new NotFoundError("RR Line");
    await writeAudit(auditCtx, {
      action: AuditAction.RR_LINE_READ,
      resource: AuditResource.RR_LINE,
      resourceId: id,
      result: AuditResult.SUCCESS,
    });
    return toRrLineDto(line as unknown as RawRrLine);
  },

  listRrLines: async (
    filters: { rrId?: string; qcStatus?: string; taggableOnly?: boolean },
    auditCtx?: AuditContext,
  ) => {
    const lines = await listRrLines({
      rrId: filters.rrId ? BigInt(filters.rrId) : undefined,
      qcStatus: filters.qcStatus,
    });
    const dtos = lines.map((line) => toRrLineDto(line as unknown as RawRrLine));
    const filtered = filters.taggableOnly ? dtos.filter((l) => l.isTaggable) : dtos;
    await writeAudit(auditCtx, {
      action: AuditAction.RR_LINE_LIST,
      resource: AuditResource.RR_LINE,
      result: AuditResult.SUCCESS,
    });
    return { lines: filtered, total: filtered.length };
  },

  checkSerialsForTagging: async (
    rrLineId: string,
    auditCtx?: AuditContext,
  ): Promise<SerialCheckResult> => {
    const line = await findRrLineById(BigInt(rrLineId));
    if (!line) throw new NotFoundError("RR Line");

    const isSerialized = line.isSerialized;
    const expectedQty = Number(line.orderedQty);

    const serials: string[] = line.serialNumbers
      ? line.serialNumbers
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

    const issues: SerialCheckResult["issues"] = [];
    let canProceed = true;

    if (isSerialized) {
      if (serials.length === 0) {
        issues.push({
          code: "SERIAL_MISSING",
          severity: "BLOCKER",
          message: "This is a serialized item but no serial numbers found in IFS.",
          action: "GO_TO_IFS_UPDATE_SERIALS",
        });
        canProceed = false;
      } else if (serials.length !== expectedQty) {
        issues.push({
          code: "SERIAL_COUNT_MISMATCH",
          severity: "BLOCKER",
          message: `Expected ${expectedQty} serials but IFS has ${serials.length}.`,
          action: "GO_TO_IFS_UPDATE_SERIALS",
        });
        canProceed = false;
      }

      // Explicitly typed parameters for filter
      const dupes = serials.filter((s: string, i: number) => serials.indexOf(s) !== i);
      if (dupes.length > 0) {
        issues.push({
          code: "SERIAL_DUPLICATE",
          severity: "BLOCKER",
          message: `Duplicate serials in IFS: ${dupes.join(", ")}`,
          action: "GO_TO_IFS_FIX_DUPLICATES",
        });
        canProceed = false;
      }
    }

    await writeAudit(auditCtx, {
      action: AuditAction.RR_LINE_SERIAL_CHECK,
      resource: AuditResource.RR_LINE,
      resourceId: rrLineId,
      result: canProceed ? AuditResult.SUCCESS : AuditResult.FAILURE,
    });

    return {
      rrLineId,
      itemCode: line.itemCode,
      isSerialized,
      expectedQty,
      serialsInIfs: serials,
      serialsCount: serials.length,
      canProceedTagging: canProceed,
      issues,
    };
  },
};
