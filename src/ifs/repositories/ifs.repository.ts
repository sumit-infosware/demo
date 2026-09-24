import { ifsClient } from "../client/ifs-client.js";
import type {
  IfsGateEntryDetail,
  IfsGateEntryHeader,
  IfsInventoryPart,
  IfsInventoryPartLocation,
  IfsInventoryStock,
  IfsPartCatalog,
  IfsWatermarkCursor,
} from "../types/ifs.types.js";
import { IFS_TABLES } from "../types/ifs.types.js";

/**
 * IFS repository — the only module that issues SQL against the external IFS
 * MySQL database. SITS business logic (rr, rr-line, tags, holding, binning,
 * put-away, transfer, ...) never runs IFS queries directly; it goes through
 * the IFS integration interface (src/ifs/services/fetch.service.ts).
 *
 * READ-ONLY: every statement here is a SELECT, and IfsClient refuses non-SELECT
 * statements outright. IFS → SITS only.
 */

/**
 * Every IFS column is aliased to its camelCase TS key so the row objects
 * returned by mysql2 expose the exact keys the IfsGateEntry* types expect
 * (mysql2 returns columns under their raw names, e.g. `GATE_ENTRY_NO`).
 * The VALUE itself is never transformed — it is stored in SITS unchanged.
 */
const COLUMNS = {
  header: [
    "GATE_ENTRY_NO AS gateEntryNo",
    "VENDOR_NO AS vendorNo",
    "GATE_ENTRY_DATE AS gateEntryDate",
    "PREFIX AS prefix",
  ],
  detail: [
    "id",
    "GATE_ENTRY_NO AS gateEntryNo",
    "PART_NO AS partNo",
    "RECEIPT_NO AS receiptNo",
    "CHALLAN_QTY AS challanQty",
    "RECEIVED_QTY AS receivedQty",
    "ACCEPTED_QTY AS acceptedQty",
    "DESCRIPTION AS description",
    "UNIT_MEAS AS unitMeas",
    "STATUS AS status",
    "HOLD AS hold",
    "CHARGES_APPROVED AS chargesApproved",
    "LOT_BATCH_NO AS lotBatchNo",
    "NOTE_TEXT AS noteText",
    "CONVERSION_FACTOR AS conversionFactor",
    "INVENTORY_QTY AS inventoryQty",
    "CURRENCY_RATE AS currencyRate",
  ],
  partCatalog: [
    "PART_NO AS partNo",
    "DESCRIPTION AS description",
    "UNIT_CODE AS unitCode",
    "LOT_TRACKING_CODE AS lotTrackingCode",
    "SERIAL_RULE AS serialRule",
    "SERIAL_TRACKING_CODE AS serialTrackingCode",
  ],
  inventoryPart: [
    "id",
    "PART_NO AS partNo",
    "ASSET_CLASS AS assetClass",
    "PART_STATUS AS partStatus",
    "UNIT_MEAS AS unitMeas",
    "DESCRIPTION AS description",
    "WEIGHT_NET AS weightNet",
  ],
  location: [
    "id",
    "PART_NO AS partNo",
    "LOCATION_NO AS locationNo",
    "SERIAL_NO AS serialNo",
    "WAREHOUSE AS warehouse",
    "BAY_NO AS bayNo",
    "ROW_NO AS rowNo",
    "TIER_NO AS tierNo",
    "BIN_NO AS binNo",
    "LOCATION_NAME AS locationName",
  ],
  stock: [
    "id",
    "PART_NO AS partNo",
    "LOCATION_NO AS locationNo",
    "LOT_BATCH_NO AS lotBatchNo",
    "SERIAL_NO AS serialNo",
    "QTY_IN_TRANSIT AS qtyInTransit",
    "QTY_ONHAND AS qtyOnHand",
    "QTY_RESERVED AS qtyReserved",
  ],
} as const;

function sel(table: keyof typeof COLUMNS): string {
  return COLUMNS[table].join(", ");
}

export interface ListGateEntriesOptions {
  /** Fetch gate entries with GATE_ENTRY_DATE >= this date. */
  fromDate?: Date;
  /** Fetch gate entries <= lastCursor only when dates are equal. */
  lastCursor?: string;
  /** Max rows in a single batch. */
  limit: number;
}

export const ifsRepository = {
  /**
   * Deterministic cursor paging over gate-entry headers:
   *   GATE_ENTRY_DATE >= fromDate
   *   AND (GATE_ENTRY_DATE > fromDate OR (GATE_ENTRY_DATE = fromDate AND GATE_ENTRY_NO > lastCursor))
   * ordered by (GATE_ENTRY_DATE, GATE_ENTRY_NO).
   * Records sharing the same GATE_ENTRY_DATE are never skipped. Only NEW gate
   * entries are ever returned — the cursor moves strictly forward.
   */
  listGateEntryHeaders: async (opts: ListGateEntriesOptions): Promise<IfsGateEntryHeader[]> => {
    const fromDate = opts.fromDate ?? new Date(Date.UTC(1970, 0, 1));
    const cursor = opts.lastCursor ?? "";
    const sql = `
      SELECT ${sel("header")}
      FROM ${IFS_TABLES.GATE_ENTRY_HEADER}
      WHERE GATE_ENTRY_DATE >= ?
        AND (
          GATE_ENTRY_DATE > ?
          OR (
            GATE_ENTRY_DATE = ?
            AND GATE_ENTRY_NO > ?
          )
        )
      ORDER BY GATE_ENTRY_DATE ASC, GATE_ENTRY_NO ASC
      LIMIT ?;
    `;
    return ifsClient.query<IfsGateEntryHeader>(sql, [
      fromDate,
      fromDate,
      fromDate,
      cursor,
      opts.limit,
    ]);
  },

  findGateEntryHeader: async (gateEntryNo: string): Promise<IfsGateEntryHeader | null> => {
    const sql = `
      SELECT ${sel("header")}
      FROM ${IFS_TABLES.GATE_ENTRY_HEADER}
      WHERE GATE_ENTRY_NO = ?
      LIMIT 1;
    `;
    const rows = await ifsClient.query<IfsGateEntryHeader>(sql, [gateEntryNo]);
    return rows[0] ?? null;
  },

  listGateEntryDetails: async (gateEntryNo: string): Promise<IfsGateEntryDetail[]> => {
    const sql = `
      SELECT ${sel("detail")}
      FROM ${IFS_TABLES.GATE_ENTRY_DETAIL}
      WHERE GATE_ENTRY_NO = ?
      ORDER BY id ASC;
    `;
    return ifsClient.query<IfsGateEntryDetail>(sql, [gateEntryNo]);
  },

  findPartCatalog: async (partNo: string): Promise<IfsPartCatalog | null> => {
    const sql = `
      SELECT ${sel("partCatalog")}
      FROM ${IFS_TABLES.PART_CATALOG}
      WHERE PART_NO = ?
      LIMIT 1;
    `;
    const rows = await ifsClient.query<IfsPartCatalog>(sql, [partNo]);
    return rows[0] ?? null;
  },

  findInventoryPart: async (partNo: string): Promise<IfsInventoryPart | null> => {
    const sql = `
      SELECT ${sel("inventoryPart")}
      FROM ${IFS_TABLES.INVENTORY_PART}
      WHERE PART_NO = ?
      LIMIT 1;
    `;
    const rows = await ifsClient.query<IfsInventoryPart>(sql, [partNo]);
    return rows[0] ?? null;
  },

  findLocation: async (locationNo: string): Promise<IfsInventoryPartLocation | null> => {
    const sql = `
      SELECT ${sel("location")}
      FROM ${IFS_TABLES.INVENTORY_PART_LOCATION}
      WHERE LOCATION_NO = ?
      LIMIT 1;
    `;
    const rows = await ifsClient.query<IfsInventoryPartLocation>(sql, [locationNo]);
    return rows[0] ?? null;
  },

  /**
   * Every INVENTORY_PART_LOCATION row for a part (part-scoped stock rows). The
   * demo schema stores serialized units here (PART_NO + SERIAL_NO) alongside
   * their location fields — this is the serial source and pins an item's
   * default location.
   */
  listLocationsForPart: async (partNo: string): Promise<IfsInventoryPartLocation[]> => {
    const sql = `
      SELECT ${sel("location")}
      FROM ${IFS_TABLES.INVENTORY_PART_LOCATION}
      WHERE PART_NO = ?
      ORDER BY LOCATION_NO ASC;
    `;
    return ifsClient.query<IfsInventoryPartLocation>(sql, [partNo]);
  },

  listStocksForPart: async (partNo: string): Promise<IfsInventoryStock[]> => {
    const sql = `
      SELECT ${sel("stock")}
      FROM ${IFS_TABLES.INVENTORY_STOCK}
      WHERE PART_NO = ?
      ORDER BY LOT_BATCH_NO ASC;
    `;
    return ifsClient.query<IfsInventoryStock>(sql, [partNo]);
  },

  /**
   * Locates the watermark starting point for a candidate header — primarily
   * for tests/manual introspection. The poller uses IfsWatermarkService which
   * persists (GATE_ENTRY_DATE, GATE_ENTRY_NO) in SITS.
   */
  nextCursor: (header: IfsGateEntryHeader): IfsWatermarkCursor => ({
    gateEntryDate: header.gateEntryDate,
    gateEntryNo: header.gateEntryNo,
  }),
};
