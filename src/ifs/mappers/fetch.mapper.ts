import { Prisma } from "../../../prisma/generated/prisma/client.js";
import { ItemType, RrStatus } from "../../enums/status.enum.js";
import { isChargeApproved } from "../../helpers/charge-status.helper.js";
import { normalizeIfsQcStatus } from "../status/ifs-status.js";
import type {
  IfsGateEntryDetail,
  IfsGateEntryHeader,
  IfsInventoryPart,
  IfsInventoryPartLocation,
  IfsPartCatalog,
  PoOwnership,
} from "../types/ifs.types.js";
import { PO_OWNERSHIP } from "../types/ifs.types.js";

/**
 * IFS → SITS mapping.
 *
 * Fixed business mappings (must not be changed):
 *   IFS GATE_ENTRY_DETAIL.CHALLAN_QTY          → SITS RR_LINE.orderedQty
 *   IFS GATE_ENTRY_DETAIL.STATUS               → SITS RR_LINE.qcStatus  (verbatim)
 *   IFS GATE_ENTRY_DETAIL.HOLD                 → SITS RR_LINE.isHold
 *   IFS GATE_ENTRY_HEADER.GATE_ENTRY_NO        → SITS RR.rrNo  (verbatim, no prefix)
 *   IFS INVENTORY_PART.UNIT_MEAS               → SITS ITEM_MASTER.vendorUom
 *   IFS GATE_ENTRY_DETAIL.UNIT_MEAS            → SITS RR_LINE.vendorUom
 *
 * Ownership (HAL rule): REP PO / REP FOC → Repair, PO → Company. Derived in
 * SITS from GATE_ENTRY_HEADER.PREFIX. Nothing is written back to IFS.
 *
 * Missing mandatory fields are never fabricated — the line is flagged and the
 * event is recorded by fetch.service.
 */

export interface RrLineSyncInput {
  rrLineNo: string;
  gateEntryLineNo: string | null;
  receiptNo: string | null;
  itemCode: string;
  itemDesc: string | null;
  orderedQty: Prisma.Decimal;
  receivedQty: Prisma.Decimal | null;
  acceptedQty: Prisma.Decimal | null;
  vendorUom: string | null;
  stockingUom: string | null;
  conversionFactor: Prisma.Decimal | null;
  inventoryQty: Prisma.Decimal | null;
  noteText: string | null;
  isChargeApproved: boolean;
  isHold: boolean;
  qcStatus: string | null;
  chargeStatus: string | null;
  batchNo: string | null;
  itemType: string;
  isSerialized: boolean;
  requiresEngraving: boolean;
  isFractionalQty: boolean;
  computedTotalQty: Prisma.Decimal | null;
  poOwnership: PoOwnership | null;
  /** Parsed serial numbers (comma-joined) for serialized lines — from IFS NOTE_TEXT. */
  serialNumbers: string | null;
  /** Set when a mandatory field is missing → the line must be flagged, not synced. */
  flagReason: string | null;
}

export interface RrSyncInput {
  gateEntryNo: string;
  rrNo: string;
  vendorNo: string | null;
  vendorName: string | null;
  gateEntryDate: Date;
  rrStatus: string;
  poOwnership: PoOwnership | null;
  lines: RrLineSyncInput[];
}

export interface ItemMasterSyncInput {
  itemCode: string;
  description: string | null;
  stockingUom: string | null;
  vendorUom: string | null;
  countingMethod: string | null;
  unitWeightG: Prisma.Decimal | null;
  weightNet: Prisma.Decimal | null;
  assetClass: string | null;
  isSerialized: boolean;
  /** Default IFS location for the item — first INVENTORY_PART_LOCATION row per part. */
  locationNo: string | null;
}

/** One serialized unit of an item — from INVENTORY_PART_LOCATION rows with a non-null SERIAL_NO. */
export interface SerialSyncInput {
  itemCode: string;
  serialNo: string;
}

export interface ItemLocationSyncInput {
  locationNo: string;
  warehouse: string | null;
  bayNo: string | null;
  rowNo: string | null;
  tierNo: string | null;
  binNo: string | null;
  locationName: string | null;
}

export interface GateEntrySyncPayload {
  rr: RrSyncInput;
  items: ItemMasterSyncInput[];
  locations: ItemLocationSyncInput[];
  serials: SerialSyncInput[];
  /** Line indexes (into rr.lines) that were flagged for missing mandatory fields. */
  flaggedLineCount: number;
}

function toDecimal(value: string | null): Prisma.Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  return new Prisma.Decimal(value);
}

/**
 * Maps the raw IFS GATE_ENTRY_DETAIL.HOLD value to a boolean. IFS stores flags
 * as strings in mixed case (`Y`/`N`, `YES`, `TRUE`, `1`); anything unset or
 * unrecognised is treated as not-held. Same convention as isChargeApproved.
 */
function toHoldFlag(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return false;
  const s = String(raw).trim().toUpperCase();
  return s === "YES" || s === "TRUE" || s === "Y" || s === "1";
}

/**
 * Parses IFS NOTE_TEXT into serial numbers (comma-separated, trimmed, empties
 * dropped) and joins them back with commas. Rejects non-string/null/empty input.
 * Total is capped at 2000 chars to match the IFS NOTE_TEXT VARCHAR(2000) bound
 * (flow: "max 2000 total").
 */
export function parseSerialNumbers(noteText: string | null | undefined): string | null {
  if (!noteText) return null;
  const serials = noteText
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (serials.length === 0) return null;
  const joined = serials.join(",");
  return joined.length > 2000 ? joined.slice(0, 2000) : joined;
}

/**
 * HAL ownership rule derived from the PO prefix.
 * REP PO / REP FOC → Repair, PO → Company. Unknown/missing prefix → null
 * (never fabricated).
 */
export function derivePoOwnership(prefix: string | null): PoOwnership | null {
  if (!prefix) return null;
  const upper = prefix.toUpperCase();
  if (upper.includes("REP") || upper.includes("REF")) return PO_OWNERSHIP.REPAIR;
  if (upper.includes("PO")) return PO_OWNERSHIP.COMPANY;
  return null;
}

/**
 * A part is serialized when IFS declares serial tracking (PART_CATALOG
 * SERIAL_TRACKING_CODE / SERIAL_RULE). Absent serial metadata → not serialized.
 */
export function deriveIsSerialized(part: IfsPartCatalog | null): boolean {
  if (!part) return false;
  const rule = part.serialRule?.toUpperCase() ?? "";
  return Boolean(part.serialTrackingCode) || rule.includes("SERIAL");
}

function mapRrLine(
  detail: IfsGateEntryDetail,
  part: IfsPartCatalog | null,
  invPart: IfsInventoryPart | null,
  ownership: PoOwnership | null,
): RrLineSyncInput {
  const missingPartNo = !detail.partNo;
  const missingChallanQty =
    detail.challanQty === null || detail.challanQty === undefined || detail.challanQty === "";

  const itemCode = detail.partNo ?? "";
  const isSerialized = deriveIsSerialized(part);

  return {
    // No LINE_NO column in the supplied IFS schema → detail.id is the stable
    // per-row line identifier (flagged in the change report).
    rrLineNo: String(detail.id),
    gateEntryLineNo: String(detail.id),
    receiptNo: detail.receiptNo ?? null,
    itemCode,
    itemDesc: detail.description ?? part?.description ?? invPart?.description ?? null,
    orderedQty: toDecimal(detail.challanQty) ?? new Prisma.Decimal(0),
    receivedQty: toDecimal(detail.receivedQty),
    acceptedQty: toDecimal(detail.acceptedQty),
    vendorUom: detail.unitMeas ?? null,
    stockingUom: invPart?.unitMeas ?? part?.unitCode ?? detail.unitMeas ?? null,
    conversionFactor: toDecimal(detail.conversionFactor),
    inventoryQty: toDecimal(detail.inventoryQty),
    noteText: detail.noteText,
    isChargeApproved: isChargeApproved(detail.chargesApproved),
    isHold: toHoldFlag(detail.hold),
    qcStatus: normalizeIfsQcStatus(detail.status),
    chargeStatus: detail.chargesApproved ?? null,
    batchNo: detail.lotBatchNo ?? null,
    itemType: isSerialized ? ItemType.SERIALIZED : ItemType.BULK,
    isSerialized,
    requiresEngraving: false,
    isFractionalQty: detail.unitMeas?.toUpperCase() === "FT" || Boolean(detail.conversionFactor),
    computedTotalQty: toDecimal(detail.inventoryQty),
    poOwnership: ownership,
    serialNumbers: isSerialized ? parseSerialNumbers(detail.noteText) : null,
    flagReason:
      missingPartNo || missingChallanQty
        ? `missing mandatory field: ${missingPartNo && missingChallanQty ? "PART_NO, CHALLAN_QTY" : missingPartNo ? "PART_NO" : "CHALLAN_QTY"}`
        : null,
  };
}

/**
 * Builds the full normalized sync payload for one gate entry.
 * Reads are intentionally left to the caller (ifsRepository) so this mapper
 * stays a pure mapping function.
 */
export function buildGateEntryPayload(args: {
  header: IfsGateEntryHeader;
  details: IfsGateEntryDetail[];
  parts: Map<string, IfsPartCatalog | null>;
  inventoryParts: Map<string, IfsInventoryPart | null>;
  locations: Map<string, IfsInventoryPartLocation[]>;
}): GateEntrySyncPayload {
  const { header, details, parts, inventoryParts, locations } = args;

  const ownership = derivePoOwnership(header.prefix);

  const rr: RrSyncInput = {
    gateEntryNo: header.gateEntryNo,
    rrNo: header.gateEntryNo,
    vendorNo: header.vendorNo ?? null,
    vendorName: null, // no VENDOR_NAME column in supplied IFS schema — never fabricated
    gateEntryDate: header.gateEntryDate,
    rrStatus: RrStatus.OPEN,
    poOwnership: ownership,
    lines: [],
  };

  const items = new Map<string, ItemMasterSyncInput>();
  const locationInputs = new Map<string, ItemLocationSyncInput>();
  const serials = new Map<string, SerialSyncInput>();
  let flaggedLineCount = 0;

  for (const detail of details) {
    const line = mapRrLine(
      detail,
      parts.get(detail.partNo ?? "") ?? null,
      inventoryParts.get(detail.partNo ?? "") ?? null,
      ownership,
    );
    rr.lines.push(line);
    if (line.flagReason) {
      flaggedLineCount += 1;
      continue;
    }

    const part = parts.get(detail.partNo ?? "") ?? null;
    const invPart = inventoryParts.get(detail.partNo ?? "") ?? null;
    if (part || invPart) {
      // First INVENTORY_PART_LOCATION row per part (listLocationsForPart orders
      // by LOCATION_NO asc) — ItemMaster points at its default IFS location.
      const partLocations = locations.get(detail.partNo ?? "") ?? [];
      items.set(detail.partNo as string, {
        itemCode: detail.partNo as string,
        description: part?.description ?? invPart?.description ?? line.itemDesc,
        stockingUom: invPart?.unitMeas ?? part?.unitCode ?? null,
        vendorUom: invPart?.unitMeas ?? null,
        countingMethod: part?.serialRule ?? null,
        unitWeightG: toDecimal(invPart?.weightNet ?? null),
        weightNet: toDecimal(invPart?.weightNet ?? null),
        assetClass: invPart?.assetClass ?? null,
        isSerialized: line.isSerialized,
        locationNo: partLocations[0]?.locationNo ?? null,
      });
      // Every serialized unit of the part (INVENTORY_PART_LOCATION rows with a
      // non-null SERIAL_NO). Deduplicated per part so a row repeated across
      // locations never inserts a duplicate serial.
      for (const loc of partLocations) {
        if (!loc.serialNo) continue;
        serials.set(`${detail.partNo}|${loc.serialNo}`, {
          itemCode: detail.partNo as string,
          serialNo: loc.serialNo,
        });
      }
    }
  }

  for (const locRow of [...locations.values()].flat()) {
    if (locationInputs.has(locRow.locationNo)) continue;
    locationInputs.set(locRow.locationNo, {
      locationNo: locRow.locationNo,
      warehouse: locRow.warehouse,
      bayNo: locRow.bayNo,
      rowNo: locRow.rowNo,
      tierNo: locRow.tierNo,
      binNo: locRow.binNo,
      locationName: locRow.locationName,
    });
  }

  return {
    rr,
    items: [...items.values()],
    locations: [...locationInputs.values()],
    serials: [...serials.values()],
    flaggedLineCount,
  };
}
