/**
 * IFS external-data types.
 *
 * These mirror the dummy/demo IFS MySQL schema (the "supplied schema").
 * Table + column names are centralized here so the dummy implementation can be
 * swapped for the real IFS connection by updating these constants and the
 * SELECT queries in `src/ifs/repositories/ifs.repository.ts` — the rest of the
 * SITS application only ever talks to the mapping/Sync layer below.
 *
 * IFS is READ-ONLY from SITS's perspective. mysql2 returns BIGINT columns as
 * strings and DECIMAL columns as strings by default (see IfsClient options),
 * so every numeric field below is typed `string` and converted via Prisma.Decimal.
 */

import { IFS_TABLES, type IfsTableName } from "../constants/ifs-tables.constants.js";

export { IFS_TABLES, type IfsTableName };

export interface IfsGateEntryHeader {
  gateEntryNo: string;
  vendorNo: string;
  gateEntryDate: Date;
  prefix: string | null;
}

export interface IfsGateEntryDetail {
  id: number;
  gateEntryNo: string;
  partNo: string | null;
  receiptNo: string | null;
  challanQty: string;
  receivedQty: string | null;
  acceptedQty: string | null;
  description: string | null;
  unitMeas: string | null;
  status: string | null;
  hold: string | null;
  chargesApproved: string | null;
  lotBatchNo: string | null;
  noteText: string | null;
  conversionFactor: string | null;
  inventoryQty: string | null;
  currencyRate: string | null;
}

/**
 * Row shape expected from the read-only IFS charge-status view
 * (`IFS_CHARGE_STATUS_VIEW`). The view is filtered by the natural keys of an
 * RR line (gate entry no + receipt no) — both columns already exist on
 * `gate_entry_details`. `CHARGES_APPROVED` is the live approval signal that
 * drives the transit-exit charge gate.
 */
export interface IfsChargeStatus {
  gateEntryNo: string;
  receiptNo: string | null;
  chargesApproved: string | null;
}

export interface IfsPartCatalog {
  partNo: string;
  description: string | null;
  unitCode: string | null;
  lotTrackingCode: string | null;
  serialRule: string | null;
  serialTrackingCode: string | null;
}

export interface IfsInventoryPart {
  id: number;
  partNo: string;
  assetClass: string | null;
  partStatus: string | null;
  unitMeas: string | null;
  description: string | null;
  weightNet: string | null;
}

export interface IfsInventoryPartLocation {
  id: number;
  partNo: string;
  locationNo: string;
  serialNo: string | null;
  warehouse: string | null;
  bayNo: string | null;
  rowNo: string | null;
  tierNo: string | null;
  binNo: string | null;
  locationName: string | null;
}

export interface IfsInventoryStock {
  id: number;
  partNo: string;
  locationNo: string;
  lotBatchNo: string;
  serialNo: string | null;
  qtyInTransit: string;
  qtyOnHand: string;
  qtyReserved: string;
}

/** Composite cursor used to page gate entries sharing the same date. */
export interface IfsWatermarkCursor {
  gateEntryDate: Date;
  gateEntryNo: string;
}

import {
  GATE_ENTRY_STATE,
  type GateEntryState,
  PO_OWNERSHIP,
  type PoOwnership,
} from "../enums/ifs-sync-status.enum.js";

export { GATE_ENTRY_STATE, PO_OWNERSHIP, type GateEntryState, type PoOwnership };
