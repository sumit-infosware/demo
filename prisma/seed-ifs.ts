import { createConnection } from "mysql2/promise";
import { env } from "../src/config/env.js";

/**
 * IFS demo-data seed (external MySQL — READ-ONLY from SITS).
 *
 * Creates the dummy IFS database + tables (supplied demo schema) and loads
 * demo gate entries, part masters, locations and stock so the IFS integration
 * (poll/watermark/manual fetch) can be exercised end-to-end.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS + INSERT ... ON DUPLICATE KEY UPDATE,
 * safe to run repeatedly. Also performs a non-destructive column-add for
 * GATE_ENTRY_DETAILS.HOLD on pre-existing installs. Does NOT touch the SITS
 * PostgreSQL database.
 *
 *   npm run db:seed:ifs
 */

interface HeaderRow {
  GATE_ENTRY_NO: number;
  VENDOR_NO: string;
  GATE_ENTRY_DATE: string;
  PREFIX: string | null;
}

interface DetailRow {
  id: number;
  GATE_ENTRY_NO: number;
  PART_NO: string | null;
  RECEIPT_NO: number | null;
  CHALLAN_QTY: number | null;
  RECEIVED_QTY: number | null;
  ACCEPTED_QTY: number | null;
  DESCRIPTION: string | null;
  UNIT_MEAS: string | null;
  STATUS: string | null;
  HOLD: string | null;
  CHARGES_APPROVED: string | null;
  LOT_BATCH_NO: string | null;
  NOTE_TEXT: string | null;
  CONVERSION_FACTOR: number | null;
  INVENTORY_QTY: number | null;
  CURRENCY_RATE: number | null;
}

interface CatalogRow {
  PART_NO: string;
  DESCRIPTION: string | null;
  UNIT_CODE: string | null;
  LOT_TRACKING_CODE: string | null;
  SERIAL_RULE: string | null;
  SERIAL_TRACKING_CODE: string | null;
}

interface InventoryPartRow {
  id: number;
  PART_NO: string;
  ASSET_CLASS: string | null;
  PART_STATUS: string | null;
  UNIT_MEAS: string | null;
  DESCRIPTION: string | null;
  WEIGHT_NET: number | null;
}

interface LocationRow {
  id: number;
  PART_NO: string;
  LOCATION_NO: string;
  SERIAL_NO: string | null;
  WAREHOUSE: string | null;
  BAY_NO: string | null;
  ROW_NO: string | null;
  TIER_NO: string | null;
  BIN_NO: string | null;
  LOCATION_NAME: string | null;
}

interface StockRow {
  id: number;
  PART_NO: string;
  LOCATION_NO: string;
  LOT_BATCH_NO: string | null;
  SERIAL_NO: string | null;
  QTY_IN_TRANSIT: number | null;
  QTY_ONHAND: number | null;
  QTY_RESERVED: number | null;
}

const HEADERS: HeaderRow[] = [
  { GATE_ENTRY_NO: 2411001, VENDOR_NO: "VEN-0007", GATE_ENTRY_DATE: "2026-08-25", PREFIX: "PO" },
  {
    GATE_ENTRY_NO: 2411002,
    VENDOR_NO: "VEN-0007",
    GATE_ENTRY_DATE: "2026-08-26",
    PREFIX: "REP PO",
  },
  { GATE_ENTRY_NO: 2411003, VENDOR_NO: "VEN-0012", GATE_ENTRY_DATE: "2026-08-27", PREFIX: "PO" },
  { GATE_ENTRY_NO: 2411004, VENDOR_NO: "VEN-0055", GATE_ENTRY_DATE: "2026-08-28", PREFIX: "REP" },
  { GATE_ENTRY_NO: 2411005, VENDOR_NO: "VEN-0099", GATE_ENTRY_DATE: "2026-08-29", PREFIX: "" },
  { GATE_ENTRY_NO: 2411006, VENDOR_NO: "VEN-0012", GATE_ENTRY_DATE: "2026-08-30", PREFIX: "PO" },
  { GATE_ENTRY_NO: 1001, VENDOR_NO: "V-BEL-01", GATE_ENTRY_DATE: "2025-01-10", PREFIX: "PO" },
  { GATE_ENTRY_NO: 1002, VENDOR_NO: "V-HAL-02", GATE_ENTRY_DATE: "2025-01-11", PREFIX: "PO" },
  { GATE_ENTRY_NO: 1003, VENDOR_NO: "V-MT-03", GATE_ENTRY_DATE: "2025-01-12", PREFIX: "PO" },
  { GATE_ENTRY_NO: 1004, VENDOR_NO: "V-LT-04", GATE_ENTRY_DATE: "2025-01-13", PREFIX: "PO" },
  { GATE_ENTRY_NO: 1005, VENDOR_NO: "V-GJ-05", GATE_ENTRY_DATE: "2025-01-14", PREFIX: "PO" },
  { GATE_ENTRY_NO: 1006, VENDOR_NO: "V-BF-06", GATE_ENTRY_DATE: "2025-01-15", PREFIX: "PO" },
  { GATE_ENTRY_NO: 1007, VENDOR_NO: "VEN-0007", GATE_ENTRY_DATE: "2025-01-16", PREFIX: "PO" },
  { GATE_ENTRY_NO: 1008, VENDOR_NO: "V-AL-08", GATE_ENTRY_DATE: "2025-01-18", PREFIX: "PO" },
  { GATE_ENTRY_NO: 33, VENDOR_NO: "WEM060071", GATE_ENTRY_DATE: "2010-01-11", PREFIX: "PO" },
];

const DETAILS: DetailRow[] = [
  // GE-2411001 (PO → Company)
  {
    id: 1,
    GATE_ENTRY_NO: 2411001,
    PART_NO: "P-1001",
    RECEIPT_NO: 900011,
    CHALLAN_QTY: 500,
    RECEIVED_QTY: 500,
    ACCEPTED_QTY: 500,
    DESCRIPTION: "CAPACITOR, FILM, 10UF",
    UNIT_MEAS: "EA",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: "LOT-2408-04",
    NOTE_TEXT: "SN-2408-001,SN-2408-002,SN-2408-003",
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 0,
    CURRENCY_RATE: null,
  },
  {
    id: 2,
    GATE_ENTRY_NO: 2411001,
    PART_NO: "P-2001",
    RECEIPT_NO: 900012,
    CHALLAN_QTY: 25,
    RECEIVED_QTY: 25,
    ACCEPTED_QTY: 25,
    DESCRIPTION: "GEAR, ACTUATOR H-212",
    UNIT_MEAS: "EA",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: null,
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 25,
    CURRENCY_RATE: null,
  },
  {
    id: 3,
    GATE_ENTRY_NO: 2411001,
    PART_NO: "P-3001",
    RECEIPT_NO: 900013,
    CHALLAN_QTY: 10,
    RECEIVED_QTY: 10,
    ACCEPTED_QTY: 0,
    DESCRIPTION: "PANEL, CONTROL, LH",
    UNIT_MEAS: "EA",
    STATUS: "Pending Inspection",
    HOLD: "N",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: "LOT-2408-02",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 10,
    CURRENCY_RATE: null,
  },
  // GE-2411002 (REP PO → Repair)
  {
    id: 4,
    GATE_ENTRY_NO: 2411002,
    PART_NO: "P-1002",
    RECEIPT_NO: 900021,
    CHALLAN_QTY: 10000,
    RECEIVED_QTY: 10000,
    ACCEPTED_QTY: 10000,
    DESCRIPTION: "RESISTOR, CHIP 0402",
    UNIT_MEAS: "EA",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: null,
    NOTE_TEXT: null,
    CONVERSION_FACTOR: null,
    INVENTORY_QTY: null,
    CURRENCY_RATE: null,
  },
  {
    id: 5,
    GATE_ENTRY_NO: 2411002,
    PART_NO: "P-2002",
    RECEIPT_NO: 900022,
    CHALLAN_QTY: 200,
    RECEIVED_QTY: 200,
    ACCEPTED_QTY: 200,
    DESCRIPTION: "SEAL, O-RING, NITRILE",
    UNIT_MEAS: "EA",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: null,
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 200,
    CURRENCY_RATE: null,
  },
  {
    id: 6,
    GATE_ENTRY_NO: 2411002,
    PART_NO: "P-1003",
    RECEIPT_NO: 900023,
    CHALLAN_QTY: 15,
    RECEIVED_QTY: 15,
    ACCEPTED_QTY: 15,
    DESCRIPTION: "IC, GATE DRIVER",
    UNIT_MEAS: "EA",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: null,
    NOTE_TEXT: "SN-2408-101,SN-2408-102,SN-2408-103",
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 15,
    CURRENCY_RATE: 84.5,
  },
  {
    id: 27,
    GATE_ENTRY_NO: 2411002,
    PART_NO: null,
    RECEIPT_NO: 900024,
    CHALLAN_QTY: null,
    RECEIVED_QTY: null,
    ACCEPTED_QTY: null,
    DESCRIPTION: "FLAGGED LINE - missing part",
    UNIT_MEAS: "EA",
    STATUS: "Pending Inspection",
    HOLD: "N",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: null,
    NOTE_TEXT: "must be flagged, not synced",
    CONVERSION_FACTOR: null,
    INVENTORY_QTY: null,
    CURRENCY_RATE: null,
  },
  // GE-2411003 (PO → Company)
  {
    id: 7,
    GATE_ENTRY_NO: 2411003,
    PART_NO: "P-1001",
    RECEIPT_NO: 900031,
    CHALLAN_QTY: 250,
    RECEIVED_QTY: 250,
    ACCEPTED_QTY: 250,
    DESCRIPTION: "CAPACITOR, FILM, 10UF",
    UNIT_MEAS: "EA",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "LOT-2408-03",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 250,
    CURRENCY_RATE: null,
  },
  {
    id: 8,
    GATE_ENTRY_NO: 2411003,
    PART_NO: "P-2002",
    RECEIPT_NO: 900032,
    CHALLAN_QTY: 100,
    RECEIVED_QTY: 100,
    ACCEPTED_QTY: 100,
    DESCRIPTION: "SEAL, O-RING, NITRILE",
    UNIT_MEAS: "EA",
    STATUS: "Rejected",
    HOLD: "N",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: null,
    NOTE_TEXT: "Oversize batch",
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 100,
    CURRENCY_RATE: null,
  },
  // GE-2411004 (REP → Repair)
  {
    id: 9,
    GATE_ENTRY_NO: 2411004,
    PART_NO: "P-1003",
    RECEIPT_NO: 900041,
    CHALLAN_QTY: 8,
    RECEIVED_QTY: 8,
    ACCEPTED_QTY: 0,
    DESCRIPTION: "IC, GATE DRIVER",
    UNIT_MEAS: "EA",
    STATUS: "Pending Inspection",
    HOLD: "Y",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: "LOT-2408-04",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 0,
    CURRENCY_RATE: null,
  },
  {
    id: 10,
    GATE_ENTRY_NO: 2411004,
    PART_NO: "P-1001",
    RECEIPT_NO: 900042,
    CHALLAN_QTY: 300,
    RECEIVED_QTY: 300,
    ACCEPTED_QTY: 300,
    DESCRIPTION: "CAPACITOR, FILM, 10UF",
    UNIT_MEAS: "EA",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "LOT-2408-05",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 300,
    CURRENCY_RATE: null,
  },
  // GE-2411005 (no prefix → null ownership)
  {
    id: 11,
    GATE_ENTRY_NO: 2411005,
    PART_NO: "P-2001",
    RECEIPT_NO: 900051,
    CHALLAN_QTY: 12,
    RECEIVED_QTY: 12,
    ACCEPTED_QTY: 12,
    DESCRIPTION: "GEAR, ACTUATOR H-212",
    UNIT_MEAS: "EA",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: null,
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 12,
    CURRENCY_RATE: null,
  },
  // GE-2411006 (PO → Company) — CANCELLED line
  {
    id: 12,
    GATE_ENTRY_NO: 2411006,
    PART_NO: "P-2001",
    RECEIPT_NO: 900061,
    CHALLAN_QTY: 20,
    RECEIVED_QTY: 20,
    ACCEPTED_QTY: 0,
    DESCRIPTION: "GEAR, ACTUATOR H-212",
    UNIT_MEAS: "EA",
    STATUS: "Cancelled",
    HOLD: "N",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: null,
    NOTE_TEXT: "PO line cancelled by vendor",
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 0,
    CURRENCY_RATE: null,
  },
  // GE-1001 (BEL Aerospace)
  {
    id: 20,
    GATE_ENTRY_NO: 1001,
    PART_NO: "NUT-M10-500",
    RECEIPT_NO: 910011,
    CHALLAN_QTY: 500,
    RECEIVED_QTY: 500,
    ACCEPTED_QTY: 500,
    DESCRIPTION: "Steel Nut M10 - 500 nos",
    UNIT_MEAS: "NOS",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "BATCH-NUT-001",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 500,
    CURRENCY_RATE: null,
  },
  {
    id: 21,
    GATE_ENTRY_NO: 1001,
    PART_NO: "BOLT-M12",
    RECEIPT_NO: 910012,
    CHALLAN_QTY: 1000,
    RECEIVED_QTY: 1000,
    ACCEPTED_QTY: 1000,
    DESCRIPTION: "Steel Bolt M12",
    UNIT_MEAS: "NOS",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "BATCH-BOLT-001",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 1000,
    CURRENCY_RATE: null,
  },
  {
    id: 22,
    GATE_ENTRY_NO: 1001,
    PART_NO: "AVIO-BOARD-01",
    RECEIPT_NO: 910013,
    CHALLAN_QTY: 3,
    RECEIVED_QTY: 3,
    ACCEPTED_QTY: 3,
    DESCRIPTION: "Avionics Boards - 3 serials",
    UNIT_MEAS: "NOS",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "BATCH-AVIO-001",
    NOTE_TEXT: "AVIO-SN-0001,AVIO-SN-0002,AVIO-SN-0003",
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 3,
    CURRENCY_RATE: null,
  },
  // GE-1002 (HAL Suppliers)
  {
    id: 23,
    GATE_ENTRY_NO: 1002,
    PART_NO: "WIRE-CU-1MM",
    RECEIPT_NO: 910021,
    CHALLAN_QTY: 250,
    RECEIVED_QTY: 250,
    ACCEPTED_QTY: 250,
    DESCRIPTION: "Copper Wire 1mm reel",
    UNIT_MEAS: "KG",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "BATCH-WIRE-001",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 120,
    INVENTORY_QTY: 30000,
    CURRENCY_RATE: null,
  },
  {
    id: 24,
    GATE_ENTRY_NO: 1002,
    PART_NO: "WASHER-M10",
    RECEIPT_NO: 910022,
    CHALLAN_QTY: 2000,
    RECEIVED_QTY: 2000,
    ACCEPTED_QTY: 2000,
    DESCRIPTION: "Washers accepted",
    UNIT_MEAS: "NOS",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "BATCH-WSH-002",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 2000,
    CURRENCY_RATE: null,
  },
  // GE-1003 (MTAR Technologies)
  {
    id: 25,
    GATE_ENTRY_NO: 1003,
    PART_NO: "TURBINE-BLADE",
    RECEIPT_NO: 910031,
    CHALLAN_QTY: 2,
    RECEIVED_QTY: 2,
    ACCEPTED_QTY: 0,
    DESCRIPTION: "Turbine Blades - QC pending",
    UNIT_MEAS: "NOS",
    STATUS: "Pending Inspection",
    HOLD: "N",
    CHARGES_APPROVED: "N",
    LOT_BATCH_NO: "BATCH-TURB-001",
    NOTE_TEXT: "TURB-SN-0001,TURB-SN-0002",
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 2,
    CURRENCY_RATE: null,
  },
  // GE-1004 (L&T Aero)
  {
    id: 26,
    GATE_ENTRY_NO: 1004,
    PART_NO: "BOLT-M8",
    RECEIPT_NO: 910041,
    CHALLAN_QTY: 5000,
    RECEIVED_QTY: 5000,
    ACCEPTED_QTY: 5000,
    DESCRIPTION: "M8 Bolts weight-count",
    UNIT_MEAS: "NOS",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "BATCH-BOLT-M8",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 5000,
    CURRENCY_RATE: null,
  },
  {
    id: 28,
    GATE_ENTRY_NO: 1004,
    PART_NO: "HYDRA-VALVE-01",
    RECEIPT_NO: 910042,
    CHALLAN_QTY: 5,
    RECEIVED_QTY: 5,
    ACCEPTED_QTY: 5,
    DESCRIPTION: "Hydraulic Valves - 5 serials",
    UNIT_MEAS: "NOS",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "BATCH-HYD-001",
    NOTE_TEXT: "HYD-SN-0001,HYD-SN-0002,HYD-SN-0003,HYD-SN-0004,HYD-SN-0005",
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 5,
    CURRENCY_RATE: null,
  },
  // GE-33 (Real HAL)
  {
    id: 29,
    GATE_ENTRY_NO: 33,
    PART_NO: "21313096",
    RECEIPT_NO: 910051,
    CHALLAN_QTY: 40,
    RECEIVED_QTY: 40,
    ACCEPTED_QTY: 40,
    DESCRIPTION: "BALANCE WEIGHT",
    UNIT_MEAS: "NO",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "LOT-6018",
    NOTE_TEXT: null,
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 40,
    CURRENCY_RATE: null,
  },
  {
    id: 30,
    GATE_ENTRY_NO: 33,
    PART_NO: "282901-0225-B",
    RECEIPT_NO: 910052,
    CHALLAN_QTY: 6,
    RECEIVED_QTY: 6,
    ACCEPTED_QTY: 6,
    DESCRIPTION: "'B' PART FOR FDR (6 serials)",
    UNIT_MEAS: "NO",
    STATUS: "Inspected",
    HOLD: "N",
    CHARGES_APPROVED: "Y",
    LOT_BATCH_NO: "LOT-6530",
    NOTE_TEXT:
      "SLNO\\LOT\\6530\\*\\1,SLNO\\LOT\\6530\\*\\2,SLNO\\LOT\\6530\\*\\3,SLNO\\LOT\\6530\\*\\4,SLNO\\LOT\\6530\\*\\5,SLNO\\LOT\\6530\\*\\6",
    CONVERSION_FACTOR: 1,
    INVENTORY_QTY: 6,
    CURRENCY_RATE: null,
  },
];

const CATALOG: CatalogRow[] = [
  {
    PART_NO: "P-1001",
    DESCRIPTION: "CAPACITOR, FILM, 10UF",
    UNIT_CODE: "EA",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "P-1002",
    DESCRIPTION: "RESISTOR, CHIP 0402",
    UNIT_CODE: "EA",
    LOT_TRACKING_CODE: null,
    SERIAL_RULE: "SERIAL",
    SERIAL_TRACKING_CODE: "S1",
  },
  {
    PART_NO: "P-1003",
    DESCRIPTION: "IC, GATE DRIVER",
    UNIT_CODE: "EA",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: "SERIAL",
    SERIAL_TRACKING_CODE: "S1",
  },
  {
    PART_NO: "P-2001",
    DESCRIPTION: "GEAR, ACTUATOR H-212",
    UNIT_CODE: "EA",
    LOT_TRACKING_CODE: null,
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "P-2002",
    DESCRIPTION: "SEAL, O-RING, NITRILE",
    UNIT_CODE: "EA",
    LOT_TRACKING_CODE: null,
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "P-3001",
    DESCRIPTION: "PANEL, CONTROL, LH",
    UNIT_CODE: "EA",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "NUT-M10-500",
    DESCRIPTION: "Steel Nut M10",
    UNIT_CODE: "NOS",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "BOLT-M12",
    DESCRIPTION: "Steel Bolt M12x50",
    UNIT_CODE: "NOS",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "BOLT-M8",
    DESCRIPTION: "Steel Bolt M8x30",
    UNIT_CODE: "NOS",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "WIRE-CU-1MM",
    DESCRIPTION: "Copper Wire 1mm",
    UNIT_CODE: "MTR",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "AVIO-BOARD-01",
    DESCRIPTION: "Avionics Board (Serialized)",
    UNIT_CODE: "NOS",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: "SERIAL",
    SERIAL_TRACKING_CODE: "S1",
  },
  {
    PART_NO: "TURBINE-BLADE",
    DESCRIPTION: "Turbine Blade (Serialized)",
    UNIT_CODE: "NOS",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: "SERIAL",
    SERIAL_TRACKING_CODE: "S1",
  },
  {
    PART_NO: "HYDRA-VALVE-01",
    DESCRIPTION: "Hydraulic Valve (Serialized)",
    UNIT_CODE: "NOS",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: "SERIAL",
    SERIAL_TRACKING_CODE: "S1",
  },
  {
    PART_NO: "WASHER-M10",
    DESCRIPTION: "Steel Washer M10",
    UNIT_CODE: "NOS",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "21313096",
    DESCRIPTION: "BALANCE WEIGHT",
    UNIT_CODE: "NO",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: null,
    SERIAL_TRACKING_CODE: null,
  },
  {
    PART_NO: "282901-0225-B",
    DESCRIPTION: "'B' PART FOR FDR",
    UNIT_CODE: "NO",
    LOT_TRACKING_CODE: "LOT",
    SERIAL_RULE: "SERIAL",
    SERIAL_TRACKING_CODE: "S1",
  },
];

const INVENTORY_PART: InventoryPartRow[] = [
  {
    id: 1,
    PART_NO: "P-1001",
    ASSET_CLASS: "RAW",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "EA",
    DESCRIPTION: "CAPACITOR, FILM, 10UF",
    WEIGHT_NET: 0.002,
  },
  {
    id: 2,
    PART_NO: "P-1002",
    ASSET_CLASS: "RAW",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "EA",
    DESCRIPTION: "RESISTOR, CHIP 0402",
    WEIGHT_NET: 0.0002,
  },
  {
    id: 3,
    PART_NO: "P-1003",
    ASSET_CLASS: "RAW",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "EA",
    DESCRIPTION: "IC, GATE DRIVER",
    WEIGHT_NET: 0.015,
  },
  {
    id: 4,
    PART_NO: "P-2001",
    ASSET_CLASS: "MECH",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "EA",
    DESCRIPTION: "GEAR, ACTUATOR H-212",
    WEIGHT_NET: 1.25,
  },
  {
    id: 5,
    PART_NO: "P-2002",
    ASSET_CLASS: "MECH",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "EA",
    DESCRIPTION: "SEAL, O-RING, NITRILE",
    WEIGHT_NET: 0.01,
  },
  {
    id: 6,
    PART_NO: "P-3001",
    ASSET_CLASS: "AIRFRAME",
    PART_STATUS: "INACTIVE",
    UNIT_MEAS: "EA",
    DESCRIPTION: "PANEL, CONTROL, LH",
    WEIGHT_NET: 4.1,
  },
  {
    id: 7,
    PART_NO: "NUT-M10-500",
    ASSET_CLASS: "CN",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "NOS",
    DESCRIPTION: "Steel Nut M10",
    WEIGHT_NET: 0.0035,
  },
  {
    id: 8,
    PART_NO: "BOLT-M12",
    ASSET_CLASS: "CN",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "NOS",
    DESCRIPTION: "Steel Bolt M12x50",
    WEIGHT_NET: 0.025,
  },
  {
    id: 9,
    PART_NO: "AVIO-BOARD-01",
    ASSET_CLASS: "SR",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "NOS",
    DESCRIPTION: "Avionics Board",
    WEIGHT_NET: 0.25,
  },
  {
    id: 10,
    PART_NO: "WIRE-CU-1MM",
    ASSET_CLASS: "CN",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "KG",
    DESCRIPTION: "Copper Wire 1mm",
    WEIGHT_NET: 1.0,
  },
  {
    id: 11,
    PART_NO: "21313096",
    ASSET_CLASS: "PUR",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "NO",
    DESCRIPTION: "BALANCE WEIGHT",
    WEIGHT_NET: 0.45,
  },
  {
    id: 12,
    PART_NO: "282901-0225-B",
    ASSET_CLASS: "SR",
    PART_STATUS: "ACTIVE",
    UNIT_MEAS: "NO",
    DESCRIPTION: "'B' PART FOR FDR",
    WEIGHT_NET: 0.85,
  },
];

const LOCATIONS: LocationRow[] = [
  {
    id: 1,
    PART_NO: "P-1001",
    LOCATION_NO: "WH-01-A-01-01-01",
    SERIAL_NO: null,
    WAREHOUSE: "WH-01",
    BAY_NO: "A",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "01",
    LOCATION_NAME: "WH-01 Bay A Bin 01",
  },
  {
    id: 2,
    PART_NO: "P-1001",
    LOCATION_NO: "WH-01-A-01-01-02",
    SERIAL_NO: null,
    WAREHOUSE: "WH-01",
    BAY_NO: "A",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "02",
    LOCATION_NAME: "WH-01 Bay A Bin 02",
  },
  {
    id: 3,
    PART_NO: "P-2001",
    LOCATION_NO: "WH-01-B-01-01-01",
    SERIAL_NO: null,
    WAREHOUSE: "WH-01",
    BAY_NO: "B",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "01",
    LOCATION_NAME: "WH-01 Bay B Bin 01",
  },
  {
    id: 4,
    PART_NO: "P-3001",
    LOCATION_NO: "WH-02-A-01-01-01",
    SERIAL_NO: null,
    WAREHOUSE: "WH-02",
    BAY_NO: "A",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "01",
    LOCATION_NAME: "WH-02 Bay A Bin 01",
  },
  {
    id: 5,
    PART_NO: "P-1002",
    LOCATION_NO: "WH-01-B-01-01-01",
    SERIAL_NO: "SN-1002-0001",
    WAREHOUSE: "WH-01",
    BAY_NO: "B",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "01",
    LOCATION_NAME: "WH-01 Bay B Bin 01",
  },
  {
    id: 6,
    PART_NO: "P-1003",
    LOCATION_NO: "WH-02-A-02-02-03",
    SERIAL_NO: "SN-1003-0001",
    WAREHOUSE: "WH-02",
    BAY_NO: "A",
    ROW_NO: "02",
    TIER_NO: "02",
    BIN_NO: "03",
    LOCATION_NAME: "WH-02 Bay A Bin 03",
  },
  {
    id: 7,
    PART_NO: "P-2002",
    LOCATION_NO: "WH-02-B-01-01-02",
    SERIAL_NO: null,
    WAREHOUSE: "WH-02",
    BAY_NO: "B",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "02",
    LOCATION_NAME: "WH-02 Bay B Bin 02",
  },
  {
    id: 8,
    PART_NO: "P-1003",
    LOCATION_NO: "WH-02-B-02-01-01",
    SERIAL_NO: null,
    WAREHOUSE: "WH-02",
    BAY_NO: "B",
    ROW_NO: "02",
    TIER_NO: "01",
    BIN_NO: "01",
    LOCATION_NAME: "WH-02 Bay B Bin 01",
  },
  {
    id: 9,
    PART_NO: "NUT-M10-500",
    LOCATION_NO: "WH-01-A-01-01-01",
    SERIAL_NO: null,
    WAREHOUSE: "WH-01",
    BAY_NO: "A",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "01",
    LOCATION_NAME: "WH-01 Bay A Bin 01",
  },
  {
    id: 10,
    PART_NO: "BOLT-M12",
    LOCATION_NO: "WH-01-A-01-01-02",
    SERIAL_NO: null,
    WAREHOUSE: "WH-01",
    BAY_NO: "A",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "02",
    LOCATION_NAME: "WH-01 Bay A Bin 02",
  },
  {
    id: 11,
    PART_NO: "AVIO-BOARD-01",
    LOCATION_NO: "WH-02-A-01-01-01",
    SERIAL_NO: "AVIO-SN-0001",
    WAREHOUSE: "WH-02",
    BAY_NO: "A",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "01",
    LOCATION_NAME: "WH-02 Bay A Bin 01",
  },
  {
    id: 12,
    PART_NO: "21313096",
    LOCATION_NO: "WH-04-A-01-01-01",
    SERIAL_NO: null,
    WAREHOUSE: "WH-04",
    BAY_NO: "A",
    ROW_NO: "01",
    TIER_NO: "01",
    BIN_NO: "01",
    LOCATION_NAME: "WH-04 Bay A Bin 01",
  },
];

const STOCK: StockRow[] = [
  {
    id: 1,
    PART_NO: "P-1001",
    LOCATION_NO: "WH-01-A-01-01-01",
    LOT_BATCH_NO: "LOT-2408-01",
    SERIAL_NO: null,
    QTY_IN_TRANSIT: 0,
    QTY_ONHAND: 500,
    QTY_RESERVED: 0,
  },
  {
    id: 2,
    PART_NO: "P-1001",
    LOCATION_NO: "WH-01-A-01-01-02",
    LOT_BATCH_NO: "LOT-2408-03",
    SERIAL_NO: null,
    QTY_IN_TRANSIT: 0,
    QTY_ONHAND: 250,
    QTY_RESERVED: 0,
  },
  {
    id: 3,
    PART_NO: "P-2001",
    LOCATION_NO: "WH-01-B-01-01-01",
    LOT_BATCH_NO: null,
    SERIAL_NO: null,
    QTY_IN_TRANSIT: 0,
    QTY_ONHAND: 37,
    QTY_RESERVED: 0,
  },
  {
    id: 4,
    PART_NO: "P-3001",
    LOCATION_NO: "WH-02-A-01-01-01",
    LOT_BATCH_NO: "LOT-2408-02",
    SERIAL_NO: null,
    QTY_IN_TRANSIT: 10,
    QTY_ONHAND: 0,
    QTY_RESERVED: 0,
  },
  {
    id: 5,
    PART_NO: "P-1002",
    LOCATION_NO: "WH-01-B-01-01-01",
    LOT_BATCH_NO: null,
    SERIAL_NO: "SN-1002-0001",
    QTY_IN_TRANSIT: 0,
    QTY_ONHAND: 9900,
    QTY_RESERVED: 100,
  },
  {
    id: 6,
    PART_NO: "P-1003",
    LOCATION_NO: "WH-02-A-02-02-03",
    LOT_BATCH_NO: "LOT-2408-04",
    SERIAL_NO: "SN-1003-0001",
    QTY_IN_TRANSIT: 0,
    QTY_ONHAND: 8,
    QTY_RESERVED: 0,
  },
  {
    id: 7,
    PART_NO: "P-2002",
    LOCATION_NO: "WH-02-B-01-01-02",
    LOT_BATCH_NO: null,
    SERIAL_NO: null,
    QTY_IN_TRANSIT: 100,
    QTY_ONHAND: 200,
    QTY_RESERVED: 0,
  },
  {
    id: 8,
    PART_NO: "NUT-M10-500",
    LOCATION_NO: "WH-01-A-01-01-01",
    LOT_BATCH_NO: "BATCH-NUT-001",
    SERIAL_NO: null,
    QTY_IN_TRANSIT: 0,
    QTY_ONHAND: 1500,
    QTY_RESERVED: 100,
  },
  {
    id: 9,
    PART_NO: "BOLT-M12",
    LOCATION_NO: "WH-01-A-01-01-02",
    LOT_BATCH_NO: "BATCH-BOLT-001",
    SERIAL_NO: null,
    QTY_IN_TRANSIT: 0,
    QTY_ONHAND: 2000,
    QTY_RESERVED: 0,
  },
  {
    id: 10,
    PART_NO: "AVIO-BOARD-01",
    LOCATION_NO: "WH-02-A-01-01-01",
    LOT_BATCH_NO: "BATCH-AVIO-001",
    SERIAL_NO: "AVIO-SN-0001",
    QTY_IN_TRANSIT: 0,
    QTY_ONHAND: 5,
    QTY_RESERVED: 1,
  },
];

const DDL = [
  `CREATE TABLE IF NOT EXISTS gate_entry_header (
    GATE_ENTRY_NO BIGINT NOT NULL PRIMARY KEY,
    VENDOR_NO VARCHAR(25),
    GATE_ENTRY_DATE DATE,
    PREFIX VARCHAR(8)
  )`,
  `CREATE TABLE IF NOT EXISTS gate_entry_details (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    GATE_ENTRY_NO BIGINT NOT NULL,
    PART_NO VARCHAR(25),
    RECEIPT_NO BIGINT,
    CHALLAN_QTY DECIMAL(18, 4),
    RECEIVED_QTY DECIMAL(18, 4),
    ACCEPTED_QTY DECIMAL(18, 4),
    DESCRIPTION VARCHAR(50),
    UNIT_MEAS VARCHAR(15),
    STATUS VARCHAR(50),
    HOLD VARCHAR(5),
    CHARGES_APPROVED VARCHAR(5),
    LOT_BATCH_NO VARCHAR(20),
    NOTE_TEXT VARCHAR(2000),
    CONVERSION_FACTOR DECIMAL(18, 6),
    INVENTORY_QTY DECIMAL(18, 4),
    CURRENCY_RATE DECIMAL(18, 6)
  )`,
  `CREATE TABLE IF NOT EXISTS part_catalog (
    PART_NO VARCHAR(25) NOT NULL PRIMARY KEY,
    DESCRIPTION VARCHAR(50),
    UNIT_CODE VARCHAR(15),
    LOT_TRACKING_CODE VARCHAR(20),
    SERIAL_RULE VARCHAR(20),
    SERIAL_TRACKING_CODE VARCHAR(20)
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_part (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    PART_NO VARCHAR(25),
    ASSET_CLASS VARCHAR(20),
    PART_STATUS VARCHAR(20),
    UNIT_MEAS VARCHAR(15),
    DESCRIPTION VARCHAR(50),
    WEIGHT_NET DECIMAL(18, 6)
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_part_location (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    PART_NO VARCHAR(25),
    LOCATION_NO VARCHAR(25) NOT NULL,
    SERIAL_NO VARCHAR(30),
    WAREHOUSE VARCHAR(25),
    BAY_NO VARCHAR(10),
    ROW_NO VARCHAR(10),
    TIER_NO VARCHAR(10),
    BIN_NO VARCHAR(10),
    LOCATION_NAME VARCHAR(50),
    UNIQUE KEY ux_part_location_serial (LOCATION_NO, PART_NO, SERIAL_NO)
  )`,
  `CREATE TABLE IF NOT EXISTS INVENTORY_STOCK (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    PART_NO VARCHAR(25),
    LOCATION_NO VARCHAR(25),
    LOT_BATCH_NO VARCHAR(20),
    SERIAL_NO VARCHAR(30),
    QTY_IN_TRANSIT DECIMAL(18, 4),
    QTY_ONHAND DECIMAL(18, 4),
    QTY_RESERVED DECIMAL(18, 4)
  )`,
];

/**
 * Builds an idempotent multi-row upsert:
 *   INSERT ... VALUES (...) ON DUPLICATE KEY UPDATE col = VALUES(col), ...
 * Auto-increment and natural-key columns are excluded from the update list.
 */
function buildUpsert(
  table: string,
  columns: string[],
  rows: readonly unknown[],
): { sql: string; values: unknown[] } {
  const colList = columns.map((c) => `\`${c}\``).join(", ");
  const placeholders = rows.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
  const keyCol = columns[0] as string;
  const updateList = columns
    .filter((c) => c !== keyCol)
    .map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
    .join(", ");
  const values = rows.flatMap((row) =>
    columns.map((c) => {
      const value = (row as Record<string, unknown>)[c];
      return value === undefined ? null : value;
    }),
  );
  return {
    sql: `INSERT INTO \`${table}\` (${colList}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${updateList}`,
    values,
  };
}

async function main(): Promise<void> {
  const url = new URL(env.IFS_DATABASE_URL);
  const dbName = url.pathname.replace(/^\//, "") || "ifs_demo";
  url.pathname = "";
  const serverUrl = url.toString();

  console.log("IFS seed: connecting to", serverUrl, "db:", dbName);

  const conn = await createConnection({ uri: serverUrl, multipleStatements: false });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await conn.query(`USE \`${dbName}\``);

    for (const ddl of DDL) {
      await conn.query(ddl);
    }
    console.log("Tables ensured:", DDL.length);

    // Idempotent schema upgrade for databases created before GATE_ENTRY_DETAILS.HOLD
    const [holdCols] = (await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gate_entry_details' AND COLUMN_NAME = 'HOLD'",
    )) as [[{ n: number }], unknown];
    if (holdCols[0].n === 0) {
      await conn.query("ALTER TABLE `gate_entry_details` ADD COLUMN HOLD VARCHAR(5)");
      console.log("gate_entry_details: added missing column HOLD");
    }

    // Drop legacy columns if they exist
    for (const legacy of ["CREATED_AT", "UPDATED_AT"]) {
      const [cols] = (await conn.query(
        "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gate_entry_header' AND COLUMN_NAME = ?",
        [legacy],
      )) as [[{ n: number }], unknown];
      if (cols[0].n > 0) {
        await conn.query(`ALTER TABLE \`gate_entry_header\` DROP COLUMN \`${legacy}\``);
        console.log(`gate_entry_header: dropped legacy column ${legacy}`);
      }
    }

    const tables: Array<{ name: string; columns: string[]; rows: readonly unknown[] }> = [
      {
        name: "gate_entry_header",
        columns: ["GATE_ENTRY_NO", "VENDOR_NO", "GATE_ENTRY_DATE", "PREFIX"],
        rows: HEADERS,
      },
      { name: "gate_entry_details", columns: Object.keys(DETAILS[0] as DetailRow), rows: DETAILS },
      { name: "part_catalog", columns: Object.keys(CATALOG[0] as CatalogRow), rows: CATALOG },
      {
        name: "inventory_part",
        columns: Object.keys(INVENTORY_PART[0] as InventoryPartRow),
        rows: INVENTORY_PART,
      },
      {
        name: "inventory_part_location",
        columns: Object.keys(LOCATIONS[0] as LocationRow),
        rows: LOCATIONS,
      },
      { name: "INVENTORY_STOCK", columns: Object.keys(STOCK[0] as StockRow), rows: STOCK },
    ];

    for (const t of tables) {
      const { sql, values } = buildUpsert(t.name, t.columns, t.rows);
      const [result] = (await conn.query(sql, values)) as [{ affectedRows?: number }, unknown];
      console.log(
        `${t.name}: ${t.rows.length} rows (${result.affectedRows ?? t.rows.length} affected)`,
      );
    }
  } finally {
    await conn.end();
  }
  console.log("IFS seed complete.");
}

main().catch((err) => {
  console.error("IFS seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
