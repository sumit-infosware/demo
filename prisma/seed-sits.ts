import { prisma } from "../src/config/clients.js";
import { Prisma } from "./generated/prisma/client.js";
import { COUNTING_METHODS } from "../src/constants/device-types.js";
import { ROLES } from "../src/constants/roles.js";
import { AlertSeverity, AlertStatus } from "../src/enums/alert.enum.js";
import { AuditResult } from "../src/enums/audit.enum.js";
import {
  BinningPlanLineStatus,
  BinningPlanStatus,
  Ownership,
  PacketTagStatus,
  PrintStatus,
  RrLineStatus,
  RrStatus,
  StockVerificationOutcome,
  StockVerificationStatus,
  StockVerificationTrigger,
  TransferStatus,
  VarianceDisposition,
} from "../src/enums/status.enum.js";
import { IFS_LINE_STATUS } from "../src/ifs/enums/ifs-qc-status.enum.js";
import {
  IFS_GATE_ENTRY_SYNC_STATE,
  IFS_POLL_STATE,
  IFS_WATERMARK_STATUS,
} from "../src/ifs/enums/ifs-sync-status.enum.js";

/**
 * SITS project-data seed (PostgreSQL — the SITS database).
 *
 * Loads everything the existing project needs to run, in FK-safe order:
 *   [1/7] storage hierarchy (warehouses > bays > rows > tiers > bins)
 *   [2/7] device registry
 *   [3/7] item master, item locations, serials, approved alternates
 *   [4/7] receiving reports + lines
 *   [5/7] line counts
 *   [6/7] pre-tagged packets + baselines
 *   [7/7] demo transfers, count checks, put-aways, binning plans, stock verifications, alerts, variances, audit logs, ifs sync states
 *
 * Requires auth seed first (prisma/seed.ts) for countedBy/taggedBy/createdBy;
 * the admin lookup below degrades to null when it has not been run.
 * Idempotent: upserts by unique keys, safe to run repeatedly.
 *
 *   npm run db:seed:sits
 */

const WAREHOUSE_CODES = ["WH-01", "WH-02", "WH-03", "WH-04", "WH-05"];
const BAY_CODES = ["A", "B"];
const ROW_CODES = ["01", "02", "03"];
const TIER_CODES = ["01", "02"];
const BIN_CODES = ["01", "02", "03"];

async function seedHierarchy(): Promise<void> {
  console.log("🌱 Starting SITS hierarchy seed...\n");

  let tierSeq = 0;
  let binSeq = 0;
  let warehouseCount = 0;
  let bayCount = 0;
  let rowCount = 0;
  let tierCount = 0;
  let binCount = 0;

  for (const warehouseCode of WAREHOUSE_CODES) {
    const warehouse = await prisma.warehouse.upsert({
      where: { code: warehouseCode },
      update: { name: `Warehouse ${warehouseCode}` },
      create: { code: warehouseCode, name: `Warehouse ${warehouseCode}` },
    });
    warehouseCount += 1;

    for (const bayCode of BAY_CODES) {
      const bay = await prisma.bay.upsert({
        where: { warehouseId_code: { warehouseId: warehouse.id, code: bayCode } },
        update: { name: `Bay ${bayCode}` },
        create: { warehouseId: warehouse.id, code: bayCode, name: `Bay ${bayCode}` },
      });
      bayCount += 1;

      for (const rowCode of ROW_CODES) {
        const row = await prisma.row.upsert({
          where: { bayId_code: { bayId: bay.id, code: rowCode } },
          update: { name: `Row ${rowCode}` },
          create: { bayId: bay.id, code: rowCode, name: `Row ${rowCode}` },
        });
        rowCount += 1;

        for (const tierCode of TIER_CODES) {
          tierSeq += 1;
          const tierRfid = `RFID-TIER-${String(tierSeq).padStart(3, "0")}`;
          const tier = await prisma.tier.upsert({
            where: { rowId_code: { rowId: row.id, code: tierCode } },
            update: { name: `Tier ${tierCode}`, tierRfid },
            create: {
              rowId: row.id,
              code: tierCode,
              name: `Tier ${tierCode}`,
              tierRfid,
            },
          });
          tierCount += 1;

          for (const binCode of BIN_CODES) {
            binSeq += 1;
            const binRfid = `RFID-BIN-${String(binSeq).padStart(3, "0")}`;
            await prisma.bin.upsert({
              where: { tierId_code: { tierId: tier.id, code: binCode } },
              update: { name: `Bin ${binCode}`, binRfid },
              create: {
                tierId: tier.id,
                code: binCode,
                name: `Bin ${binCode}`,
                binRfid,
              },
            });
            binCount += 1;
          }
        }
      }
    }
  }

  console.log("SITS hierarchy created/updated:");
  console.log(`  Warehouses: ${warehouseCount}`);
  console.log(`  Bays:       ${bayCount}`);
  console.log(`  Rows:       ${rowCount}`);
  console.log(`  Tiers:      ${tierCount} (RFIDs assigned)`);
  console.log(`  Bins:       ${binCount} (RFIDs assigned)`);
}

async function main(): Promise<void> {
  console.log("Starting SITS project seed...");
  console.log("");
  await seedHierarchy();

  const admin = await prisma.user.findUnique({
    where: { email: "admin@gmail.com" },
    select: { id: true },
  });
  const adminUserId: string | null = admin?.id ?? null;

  // ═══════════════════════════════════════════════════════════════
  // 1️⃣ ITEM LOCATIONS (Mirror of storage hierarchy)
  // ═══════════════════════════════════════════════════════════════
  console.log("📌 [1/7] Seeding item locations...");

  const locationDefs = [
    ["WH-01-A-01-01-01", "WH-01 Bay A Row 01 Tier 01 Bin 01"],
    ["WH-01-A-01-01-02", "WH-01 Bay A Row 01 Tier 01 Bin 02"],
    ["WH-01-B-01-01-01", "WH-01 Bay B Row 01 Tier 01 Bin 01"],
    ["WH-01-B-02-01-02", "WH-01 Bay B Row 02 Tier 01 Bin 02"],
    ["WH-02-A-01-01-01", "WH-02 Bay A Row 01 Tier 01 Bin 01"],
    ["WH-02-A-02-02-03", "WH-02 Bay A Row 02 Tier 02 Bin 03"],
    ["WH-02-B-01-01-02", "WH-02 Bay B Row 01 Tier 01 Bin 02"],
    ["WH-02-B-02-01-01", "WH-02 Bay B Row 02 Tier 01 Bin 01"],
    ["WH-03-A-01-01-01", "WH-03 Bay A Row 01 Tier 01 Bin 01"],
    ["WH-04-A-01-01-01", "WH-04 Bay A Row 01 Tier 01 Bin 01"],
    ["WH-05-A-01-01-01", "WH-05 Bay A Row 01 Tier 01 Bin 01"],
  ];
  for (const [locationNo, locationName] of locationDefs as Array<[string, string]>) {
    const [warehousePrefix, warehouseNo, bayNo, rowNo, tierNo, binNo] = locationNo.split("-");
    const warehouse = `${warehousePrefix}-${warehouseNo}`;
    await prisma.itemLocation.upsert({
      where: { locationNo },
      update: { locationName, warehouse, bayNo, rowNo, tierNo, binNo },
      create: { locationNo, locationName, warehouse, bayNo, rowNo, tierNo, binNo },
    });
  }
  console.log(`   ✅ ${locationDefs.length} item locations ready`);

  // ═══════════════════════════════════════════════════════════════
  // 2️⃣ DEVICES
  // ═══════════════════════════════════════════════════════════════
  console.log("📌 [2/7] Seeding devices...");

  const devices = [
    {
      deviceId: "WM-TRANSIT-01",
      deviceType: "WEIGHING",
      location: "TRANSIT",
      displayName: "Weighing Machine - Transit Bay 1",
      controllerHost: "192.168.1.50",
      controllerPort: 8080,
      endpointPath: "/read",
    },
    {
      deviceId: "RC-TRANSIT-01",
      deviceType: "REEL_COUNTER",
      location: "TRANSIT",
      displayName: "Reel Counter",
      controllerHost: "192.168.1.50",
      controllerPort: 8080,
      endpointPath: "/read",
    },
    {
      deviceId: "PRINTER-ZT411-01",
      deviceType: "ZT411_PRINTER",
      location: "TRANSIT",
      displayName: "Zebra ZT411",
      controllerHost: "192.168.1.60",
      controllerPort: 9100,
      endpointPath: "/print",
    },
    {
      deviceId: "LASER-ENG-01",
      deviceType: "LASER_ENGRAVER",
      location: "TRANSIT",
      displayName: "Laser Engraver",
      controllerHost: "192.168.1.61",
      controllerPort: 8080,
      endpointPath: "/engrave",
    },
    {
      deviceId: "READER-4PORT-EXIT",
      deviceType: "FOUR_PORT_READER",
      location: "TRANSIT_EXIT",
      displayName: "4-Port Reader Exit",
      controllerHost: "192.168.1.70",
      controllerPort: 8080,
      endpointPath: "/scan",
    },
    {
      deviceId: "READER-4PORT-HOLDING",
      deviceType: "FOUR_PORT_READER",
      location: "HOLDING_ENTRY",
      displayName: "4-Port Reader Holding",
      controllerHost: "192.168.1.71",
      controllerPort: 8080,
      endpointPath: "/scan",
    },
    {
      deviceId: "GATE-READER-01",
      deviceType: "GATE_READER",
      location: "TRANSIT_DOOR",
      displayName: "Fixed Gate Reader",
      controllerHost: "192.168.1.72",
      controllerPort: 8080,
      endpointPath: "/scan",
    },
    {
      deviceId: "WM-HOLDING-01",
      deviceType: "WEIGHING",
      location: "HOLDING",
      displayName: "Weighing Machine Holding",
      controllerHost: "192.168.1.51",
      controllerPort: 8080,
      endpointPath: "/read",
    },
    {
      deviceId: "HANDHELD-MC33XR-01",
      deviceType: "HANDHELD_MC33XR",
      location: "HOLDING",
      displayName: "Handheld MC33xR",
      controllerHost: "192.168.1.80",
      controllerPort: 8080,
      endpointPath: "/sync",
    },
    {
      deviceId: "HANDHELD-CAMERA-01",
      deviceType: "HANDHELD_CAMERA",
      location: "TRANSIT",
      displayName: "Handheld Camera",
      controllerHost: "192.168.1.81",
      controllerPort: 8080,
      endpointPath: "/capture",
    },
    {
      deviceId: "HANDHELD-01",
      deviceType: "HANDHELD",
      location: "WAREHOUSE",
      displayName: "Warehouse General Handheld",
      controllerHost: "192.168.1.82",
      controllerPort: 8080,
      endpointPath: "/binning",
    },
  ];

  for (const d of devices) {
    await prisma.deviceRegistry.upsert({
      where: { deviceId: d.deviceId },
      update: {},
      create: { ...d, controllerProtocol: "HTTP" },
    });
  }
  console.log(`   ✅ ${devices.length} devices ready`);

  // ═══════════════════════════════════════════════════════════════
  // 3️⃣ ITEM MASTER & ALTERNATES
  // ═══════════════════════════════════════════════════════════════
  console.log("📌 [3/7] Seeding item master & alternates...");

  const items = [
    {
      itemCode: "NUT-M10-500",
      description: "Steel Nut M10",
      stockingUom: "NOS",
      vendorUom: "NOS",
      countingMethod: COUNTING_METHODS.MANUAL,
      unitWeightG: new Prisma.Decimal("3.5"),
      isSerialized: false,
      assetClass: "CN",
      locationNo: "WH-01-A-01-01-01",
    },
    {
      itemCode: "BOLT-M12",
      description: "Steel Bolt M12x50",
      stockingUom: "NOS",
      vendorUom: "NOS",
      countingMethod: COUNTING_METHODS.WEIGHT,
      unitWeightG: new Prisma.Decimal("25.0"),
      isSerialized: false,
      assetClass: "CN",
      locationNo: "WH-01-A-01-01-02",
    },
    {
      itemCode: "BOLT-M8",
      description: "Steel Bolt M8x30",
      stockingUom: "NOS",
      vendorUom: "NOS",
      countingMethod: COUNTING_METHODS.WEIGHT,
      unitWeightG: new Prisma.Decimal("12.0"),
      isSerialized: false,
      assetClass: "CN",
      locationNo: "WH-01-B-01-01-01",
    },
    {
      itemCode: "WIRE-CU-1MM",
      description: "Copper Wire 1mm",
      stockingUom: "MTR",
      vendorUom: "KG",
      countingMethod: COUNTING_METHODS.REEL,
      uomConvFactor: new Prisma.Decimal("120"),
      unitWeightG: new Prisma.Decimal("8.5"),
      isSerialized: false,
      assetClass: "CN",
      locationNo: "WH-01-B-02-01-02",
    },
    {
      itemCode: "AVIO-BOARD-01",
      description: "Avionics Board (Serialized)",
      stockingUom: "NOS",
      vendorUom: "NOS",
      countingMethod: COUNTING_METHODS.MANUAL,
      unitWeightG: new Prisma.Decimal("250.0"),
      isSerialized: true,
      assetClass: "SR",
      locationNo: "WH-02-A-01-01-01",
    },
    {
      itemCode: "TURBINE-BLADE",
      description: "Turbine Blade (Serialized)",
      stockingUom: "NOS",
      vendorUom: "NOS",
      countingMethod: COUNTING_METHODS.MANUAL,
      unitWeightG: new Prisma.Decimal("1200.0"),
      isSerialized: true,
      assetClass: "SR",
      locationNo: "WH-02-A-02-02-03",
    },
    {
      itemCode: "HYDRA-VALVE-01",
      description: "Hydraulic Valve (Serialized)",
      stockingUom: "NOS",
      vendorUom: "NOS",
      countingMethod: COUNTING_METHODS.MANUAL,
      unitWeightG: new Prisma.Decimal("450.0"),
      isSerialized: true,
      assetClass: "SR",
      locationNo: "WH-02-B-01-01-02",
    },
    {
      itemCode: "WASHER-M10",
      description: "Steel Washer M10",
      stockingUom: "NOS",
      vendorUom: "NOS",
      countingMethod: COUNTING_METHODS.WEIGHT,
      unitWeightG: new Prisma.Decimal("2.0"),
      isSerialized: false,
      assetClass: "CN",
      locationNo: "WH-02-B-02-01-01",
    },
    {
      itemCode: "PLATE-AL-5MM",
      description: "Aluminum Plate 5mm",
      stockingUom: "KG",
      vendorUom: "KG",
      countingMethod: COUNTING_METHODS.MANUAL,
      isSerialized: false,
      assetClass: "CN",
      locationNo: "WH-03-A-01-01-01",
    },
    {
      itemCode: "21313096",
      description: "BALANCE WEIGHT (Aircraft)",
      stockingUom: "NO",
      vendorUom: "NO",
      countingMethod: COUNTING_METHODS.MANUAL,
      unitWeightG: new Prisma.Decimal("450.0"),
      isSerialized: false,
      assetClass: "PUR",
      locationNo: "WH-04-A-01-01-01",
    },
    {
      itemCode: "282901-0225-B",
      description: "'B' PART FOR FDR (Serialized)",
      stockingUom: "NO",
      vendorUom: "NO",
      countingMethod: COUNTING_METHODS.MANUAL,
      unitWeightG: new Prisma.Decimal("850.0"),
      isSerialized: true,
      assetClass: "SR",
      locationNo: "WH-05-A-01-01-01",
    },
    {
      itemCode: "RES-10K-0805",
      description: "SMD Resistor 10k 0805",
      stockingUom: "NOS",
      vendorUom: "NOS",
      countingMethod: COUNTING_METHODS.REEL,
      unitWeightG: new Prisma.Decimal("0.05"),
      isSerialized: false,
      assetClass: "CN",
      locationNo: "WH-01-A-01-01-01",
    },
    {
      itemCode: "CAP-10UF-CER",
      description: "Ceramic Capacitor 10uF",
      stockingUom: "NOS",
      vendorUom: "NOS",
      countingMethod: COUNTING_METHODS.REEL,
      unitWeightG: new Prisma.Decimal("0.08"),
      isSerialized: false,
      assetClass: "CN",
      locationNo: "WH-01-A-01-01-02",
    },
  ];

  for (const i of items) {
    await prisma.itemMaster.upsert({ where: { itemCode: i.itemCode }, update: i, create: i });
  }

  const alternateDefs = [
    ["NUT-M10-500", "WASHER-M10"],
    ["BOLT-M12", "BOLT-M8"],
    ["BOLT-M8", "BOLT-M12"],
    ["AVIO-BOARD-01", "HYDRA-VALVE-01"],
    ["HYDRA-VALVE-01", "TURBINE-BLADE"],
    ["CAP-10UF-CER", "RES-10K-0805"],
  ];
  for (const [orderedItem, alternateItem] of alternateDefs as Array<[string, string]>) {
    await prisma.approvedAlternate.upsert({
      where: { orderedItem_alternateItem: { orderedItem, alternateItem } },
      update: { isApproved: true },
      create: { orderedItem, alternateItem, isApproved: true },
    });
  }
  console.log(`   ✅ ${items.length} items and ${alternateDefs.length} approved alternates ready`);

  // ═══════════════════════════════════════════════════════════════
  // 4️⃣ RRs + LINES
  // ═══════════════════════════════════════════════════════════════
  console.log("📌 [4/7] Seeding RRs + lines...");

  const rrDefs = [
    {
      rrNo: "1001",
      vendorName: "BEL Aerospace",
      vendorNo: "V-BEL-01",
      challanNo: "CH-BEL-9001",
      rrDate: "2025-01-10",
    },
    {
      rrNo: "1002",
      vendorName: "HAL Suppliers",
      vendorNo: "V-HAL-02",
      challanNo: "CH-HAL-4521",
      rrDate: "2025-01-11",
    },
    {
      rrNo: "1003",
      vendorName: "MTAR Technologies",
      vendorNo: "V-MT-03",
      challanNo: "CH-MT-7788",
      rrDate: "2025-01-12",
    },
    {
      rrNo: "1004",
      vendorName: "L&T Aero",
      vendorNo: "V-LT-04",
      challanNo: "CH-LT-1122",
      rrDate: "2025-01-13",
    },
    {
      rrNo: "1005",
      vendorName: "Godrej Aerospace",
      vendorNo: "V-GJ-05",
      challanNo: "CH-GJ-3344",
      rrDate: "2025-01-14",
    },
    {
      rrNo: "1006",
      vendorName: "Bharat Forge",
      vendorNo: "V-BF-06",
      challanNo: "CH-BF-5566",
      rrDate: "2025-01-15",
    },
    {
      rrNo: "1008",
      vendorName: "Ashok Leyland Defense",
      vendorNo: "V-AL-08",
      challanNo: "CH-AL-9900",
      rrDate: "2025-01-18",
    },
    {
      rrNo: "33",
      vendorName: "WEM060071 (HAL Vendor)",
      vendorNo: "WEM060071",
      challanNo: "64139525",
      rrDate: "2010-01-11",
    },
  ];

  const rrs: Record<string, { id: bigint }> = {};
  for (const r of rrDefs) {
    const created = await prisma.rr.upsert({
      where: { rrNo: r.rrNo },
      update: {
        gateEntryNo: r.rrNo,
        vendorName: r.vendorName,
        vendorNo: r.vendorNo,
      },
      create: {
        rrNo: r.rrNo,
        gateEntryNo: r.rrNo,
        sourceType: "DOMESTIC",
        vendorName: r.vendorName,
        vendorNo: r.vendorNo,
        contract: "KWR",
        challanNo: r.challanNo,
        challanDate: new Date(r.rrDate),
        rrStatus: RrStatus.OPEN,
        rrDate: new Date(r.rrDate),
      },
    });
    rrs[r.rrNo] = { id: created.id };
  }

  const lineDefs = [
    // GE-1001 (BEL Aerospace)
    {
      key: "L_A",
      rrNo: "1001",
      rrKey: "1001",
      vendorName: "Apex Flight Components",
      vendorNo: "V-BEL-01",
      rrLineNo: "L001",
      itemCode: "NUT-M10-500",
      itemDesc: "Steel Nut M10 - 500 nos",
      orderedQty: 500,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 5,
      qtyPerPackage: 100,
      isSerialized: false,
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-NUT-001",
    },
    {
      key: "L_B",
      rrNo: "1001",
      rrKey: "1001",
      vendorName: "Apex Flight Components",
      vendorNo: "V-BEL-01",
      rrLineNo: "L002",
      itemCode: "BOLT-M12",
      itemDesc: "Steel Bolt M12",
      orderedQty: 1000,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 10,
      qtyPerPackage: 100,
      isSerialized: false,
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-BOLT-001",
    },
    {
      key: "L_D",
      rrNo: "1001",
      rrKey: "1001",
      vendorName: "Apex Flight Components",
      vendorNo: "V-BEL-01",
      rrLineNo: "L003",
      itemCode: "AVIO-BOARD-01",
      itemDesc: "Avionics Boards - 3 serials",
      orderedQty: 3,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 3,
      qtyPerPackage: 1,
      isSerialized: true,
      serialNumbers: "AVIO-SN-0001,AVIO-SN-0002,AVIO-SN-0003",
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-AVIO-001",
    },

    // GE-1002 (HAL Suppliers)
    {
      key: "L_C",
      rrNo: "1002",
      rrKey: "1002",
      vendorName: "Vertex Aero Systems",
      vendorNo: "V-HAL-02",
      rrLineNo: "L001",
      itemCode: "WIRE-CU-1MM",
      itemDesc: "Copper Wire 1mm reel",
      orderedQty: 250,
      unitMeas: "KG",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 1,
      qtyPerPackage: 30000,
      isSerialized: false,
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-WIRE-001",
    },
    {
      key: "L_W",
      rrNo: "1002",
      rrKey: "1002",
      vendorName: "Vertex Aero Systems",
      vendorNo: "V-HAL-02",
      rrLineNo: "L002",
      itemCode: "WASHER-M10",
      itemDesc: "Washers accepted",
      orderedQty: 2000,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 4,
      qtyPerPackage: 500,
      isSerialized: false,
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-WSH-002",
    },

    // GE-1003 (MTAR Technologies)
    {
      key: "L_T",
      rrNo: "1003",
      rrKey: "1003",
      vendorName: "Orbit Precision Works",
      vendorNo: "V-MT-03",
      rrLineNo: "L001",
      itemCode: "TURBINE-BLADE",
      itemDesc: "Turbine Blades - QC pending",
      orderedQty: 2,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.TO_BE_COUNTED,
      chargeStatus: null,
      numPackages: 2,
      qtyPerPackage: 1,
      isSerialized: true,
      serialNumbers: "TURB-SN-0001,TURB-SN-0002",
      ownership: null,
      sitsStatus: RrLineStatus.OPEN,
      batch: "BATCH-TURB-001",
    },

    // GE-1004 (L&T Aero)
    {
      key: "L_G",
      rrNo: "1004",
      rrKey: "1004",
      vendorName: "Skyline Defense Parts",
      vendorNo: "V-LT-04",
      rrLineNo: "L001",
      itemCode: "BOLT-M8",
      itemDesc: "M8 Bolts weight-count",
      orderedQty: 5000,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 10,
      qtyPerPackage: 500,
      isSerialized: false,
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-BOLT-M8",
    },
    {
      key: "L_I",
      rrNo: "1004",
      rrKey: "1004",
      vendorName: "Skyline Defense Parts",
      vendorNo: "V-LT-04",
      rrLineNo: "L002",
      itemCode: "HYDRA-VALVE-01",
      itemDesc: "Hydraulic Valves - 5 serials",
      orderedQty: 5,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 5,
      qtyPerPackage: 1,
      isSerialized: true,
      serialNumbers: "HYD-SN-0001,HYD-SN-0002,HYD-SN-0003,HYD-SN-0004,HYD-SN-0005",
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-HYD-001",
    },

    // GE-1005 (Godrej — charge PENDING)
    {
      key: "L_J",
      rrNo: "1005",
      rrKey: "1005",
      vendorName: "Northstar Engineering",
      vendorNo: "V-GJ-05",
      rrLineNo: "L001",
      itemCode: "NUT-M10-500",
      itemDesc: "Nuts - charge PENDING",
      orderedQty: 300,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "PENDING",
      numPackages: 3,
      qtyPerPackage: 100,
      isSerialized: false,
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-NUT-005",
    },

    // GE-1006 (Bharat Forge)
    {
      key: "L_L",
      rrNo: "1006",
      rrKey: "1006",
      vendorName: "Pioneer Metalcraft",
      vendorNo: "V-BF-06",
      rrLineNo: "L001",
      itemCode: "PLATE-AL-5MM",
      itemDesc: "AL Plate accepted",
      orderedQty: 200,
      unitMeas: "KG",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 4,
      qtyPerPackage: 50,
      isSerialized: false,
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-PL-006",
    },

    // GE-1008 (Ashok Leyland)
    {
      key: "L_O",
      rrNo: "1008",
      rrKey: "1008",
      vendorName: "Aurora Defense Logistics",
      vendorNo: "V-AL-08",
      rrLineNo: "L001",
      itemCode: "NUT-M10-500",
      itemDesc: "Nuts - full flow test",
      orderedQty: 200,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 2,
      qtyPerPackage: 100,
      isSerialized: false,
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "BATCH-NUT-008",
    },
    {
      key: "L_R",
      rrNo: "1008",
      rrKey: "1008",
      vendorName: "Aurora Defense Logistics",
      vendorNo: "V-AL-08",
      rrLineNo: "L002",
      itemCode: "HYDRA-VALVE-01",
      itemDesc: "Rejected valves",
      orderedQty: 3,
      unitMeas: "NOS",
      qcStatus: IFS_LINE_STATUS.REJECTED,
      chargeStatus: null,
      numPackages: 3,
      qtyPerPackage: 1,
      isSerialized: true,
      serialNumbers: "HYD-REJ-001,HYD-REJ-002,HYD-REJ-003",
      ownership: null,
      sitsStatus: "REJECTED",
      batch: null,
    },

    // GE-33 (Real HAL)
    {
      key: "L_HAL33",
      rrNo: "33",
      rrKey: "33",
      vendorName: "Heritage Aircraft Supply",
      vendorNo: "WEM060071",
      rrLineNo: "L001",
      itemCode: "21313096",
      itemDesc: "BALANCE WEIGHT",
      orderedQty: 40,
      unitMeas: "NO",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 2,
      qtyPerPackage: 20,
      isSerialized: false,
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "LOT-6018",
    },
    {
      key: "L_HAL33B",
      rrNo: "33",
      rrKey: "33",
      vendorName: "Heritage Aircraft Supply",
      vendorNo: "WEM060071",
      rrLineNo: "L002",
      itemCode: "282901-0225-B",
      itemDesc: "'B' PART FOR FDR (6 serials)",
      orderedQty: 6,
      unitMeas: "NO",
      qcStatus: IFS_LINE_STATUS.INSPECTED,
      chargeStatus: "APPROVED",
      numPackages: 6,
      qtyPerPackage: 1,
      isSerialized: true,
      serialNumbers:
        "SLNO\\LOT\\6530\\*\\1,SLNO\\LOT\\6530\\*\\2,SLNO\\LOT\\6530\\*\\3,SLNO\\LOT\\6530\\*\\4,SLNO\\LOT\\6530\\*\\5,SLNO\\LOT\\6530\\*\\6",
      ownership: Ownership.HAL,
      sitsStatus: RrLineStatus.QC_ACCEPTED,
      batch: "LOT-6530",
    },
  ];

  const lines: Record<string, { id: bigint }> = {};
  for (const l of lineDefs) {
    const rrIdentifier = l.rrNo || l.rrKey;
    const rr = rrs[rrIdentifier]!;
    await prisma.rr.update({
      where: { id: rr.id },
      data: { vendorName: l.vendorName, vendorNo: l.vendorNo },
    });
    const created = await prisma.rrLine.upsert({
      where: { rrId_rrLineNo: { rrId: rr.id, rrLineNo: l.rrLineNo } },
      update: { gateEntryNo: rrIdentifier },
      create: {
        rrId: rr.id,
        rrLineNo: l.rrLineNo,
        gateEntryNo: rrIdentifier,
        gateEntryLineNo: l.rrLineNo.replace("L00", ""),
        itemCode: l.itemCode,
        itemDesc: l.itemDesc,
        category: "GENERAL",
        orderedQty: new Prisma.Decimal(l.orderedQty),
        receivedQty: new Prisma.Decimal(l.orderedQty),
        vendorUom: l.unitMeas,
        stockingUom: l.unitMeas,
        qcStatus: l.qcStatus,
        chargeStatus: l.chargeStatus,
        chargesApprovedAt: l.chargeStatus === "APPROVED" ? new Date() : null,
        batchNo: l.batch,
        numPackages: l.numPackages,
        qtyPerPackage: l.qtyPerPackage ? new Prisma.Decimal(l.qtyPerPackage) : null,
        itemType: l.isSerialized ? "SERIALIZED" : "BULK",
        isSerialized: l.isSerialized,
        serialNumbers: l.serialNumbers ?? null,
        materialType: "STEEL",
        ownership: l.ownership,
        sitsStatus: l.sitsStatus,
      },
    });
    lines[l.key] = { id: created.id };
  }
  console.log(`   ✅ ${rrDefs.length} RRs + ${lineDefs.length} lines ready`);

  const lineIds = Object.values(lines).map((l) => l.id);
  await prisma.packetTag.deleteMany({ where: { rrLineId: { in: lineIds } } });
  await prisma.lineCount.deleteMany({ where: { rrLineId: { in: lineIds } } });

  // ═══════════════════════════════════════════════════════════════
  // 5️⃣ LINE COUNTS
  // ═══════════════════════════════════════════════════════════════
  console.log("📌 [5/7] Seeding line counts...");

  const lineCountDefs = [
    {
      key: "L_A",
      method: COUNTING_METHODS.MANUAL,
      numPackages: 5,
      qtyPerPackage: 100,
      calc: 500,
      final: 500,
      ifsQty: 500,
    },
    {
      key: "L_B",
      method: COUNTING_METHODS.WEIGHT,
      numPackages: 10,
      qtyPerPackage: 100,
      unitWeightG: 25,
      totalWeightG: 25000,
      calc: 1000,
      final: 1000,
      ifsQty: 1000,
    },
    {
      key: "L_C",
      method: COUNTING_METHODS.REEL,
      numPackages: 1,
      qtyPerPackage: 30000,
      calc: 30000,
      final: 30000,
      ifsQty: 30000,
    },
    {
      key: "L_W",
      method: COUNTING_METHODS.MANUAL,
      numPackages: 4,
      qtyPerPackage: 500,
      calc: 2000,
      final: 2000,
      ifsQty: 2000,
    },
    {
      key: "L_G",
      method: COUNTING_METHODS.WEIGHT,
      numPackages: 10,
      qtyPerPackage: 500,
      unitWeightG: 12,
      totalWeightG: 60000,
      calc: 5000,
      final: 5000,
      ifsQty: 5000,
    },
    {
      key: "L_L",
      method: COUNTING_METHODS.MANUAL,
      numPackages: 4,
      qtyPerPackage: 50,
      calc: 200,
      final: 200,
      ifsQty: 200,
    },
    {
      key: "L_O",
      method: COUNTING_METHODS.MANUAL,
      numPackages: 2,
      qtyPerPackage: 100,
      calc: 200,
      final: 200,
      ifsQty: 200,
    },
    {
      key: "L_HAL33",
      method: COUNTING_METHODS.MANUAL,
      numPackages: 2,
      qtyPerPackage: 20,
      calc: 40,
      final: 40,
      ifsQty: 40,
    },
  ];

  for (const lc of lineCountDefs) {
    const line = lines[lc.key]!;
    await prisma.lineCount.create({
      data: {
        rrLineId: line.id,
        method: lc.method,
        numPackages: lc.numPackages,
        qtyPerPackage: new Prisma.Decimal(lc.qtyPerPackage),
        unitWeightG: lc.unitWeightG ? new Prisma.Decimal(lc.unitWeightG) : null,
        totalWeightG: lc.totalWeightG ? new Prisma.Decimal(lc.totalWeightG) : null,
        calculatedQty: new Prisma.Decimal(lc.calc),
        finalCountedQty: new Prisma.Decimal(lc.final),
        ifsChallanQty: new Prisma.Decimal(lc.ifsQty),
        varianceQty: new Prisma.Decimal(0),
        varianceFlag: false,
        countedBy: adminUserId,
        notes: `Seed line count for ${lc.key}`,
      },
    });
    await prisma.rrLine.update({
      where: { id: line.id },
      data: { computedTotalQty: new Prisma.Decimal(lc.final), sitsStatus: RrLineStatus.COUNTED },
    });
  }
  console.log(`   ✅ ${lineCountDefs.length} line counts ready`);

  // ═══════════════════════════════════════════════════════════════
  // 6️⃣ PRE-TAGGED PACKETS (READER-READY EPCs) + BASELINES
  // ═══════════════════════════════════════════════════════════════
  console.log("📌 [6/7] Seeding pre-tagged packets (reader-ready EPCs)...");

  const preTaggedDefs = [
    // Line A: 5 NUT packets
    {
      epc: "EPC-HAL-NUT-001",
      lineKey: "L_A",
      packetNo: 1,
      itemCode: "NUT-M10-500",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-NUT-001",
      colour: "RED",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-NUT-002",
      lineKey: "L_A",
      packetNo: 2,
      itemCode: "NUT-M10-500",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-NUT-001",
      colour: "RED",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-NUT-003",
      lineKey: "L_A",
      packetNo: 3,
      itemCode: "NUT-M10-500",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-NUT-001",
      colour: "RED",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-NUT-004",
      lineKey: "L_A",
      packetNo: 4,
      itemCode: "NUT-M10-500",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-NUT-001",
      colour: "RED",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-NUT-005",
      lineKey: "L_A",
      packetNo: 5,
      itemCode: "NUT-M10-500",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-NUT-001",
      colour: "RED",
      status: PacketTagStatus.COMMISSIONED,
    },

    // Line B: 3 BOLT packets
    {
      epc: "EPC-HAL-BOLT-001",
      lineKey: "L_B",
      packetNo: 1,
      itemCode: "BOLT-M12",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-BOLT-001",
      colour: "BLUE",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-BOLT-002",
      lineKey: "L_B",
      packetNo: 2,
      itemCode: "BOLT-M12",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-BOLT-001",
      colour: "BLUE",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-BOLT-003",
      lineKey: "L_B",
      packetNo: 3,
      itemCode: "BOLT-M12",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-BOLT-001",
      colour: "BLUE",
      status: PacketTagStatus.COMMISSIONED,
    },

    // Line D: 3 AVIO serialized
    {
      epc: "EPC-HAL-AVIO-001",
      lineKey: "L_D",
      packetNo: 1,
      itemCode: "AVIO-BOARD-01",
      serialNumber: "AVIO-SN-0001",
      qty: 1,
      uom: "NOS",
      batchNo: "BATCH-AVIO-001",
      colour: "YELLOW",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-AVIO-002",
      lineKey: "L_D",
      packetNo: 2,
      itemCode: "AVIO-BOARD-01",
      serialNumber: "AVIO-SN-0002",
      qty: 1,
      uom: "NOS",
      batchNo: "BATCH-AVIO-001",
      colour: "YELLOW",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-AVIO-003",
      lineKey: "L_D",
      packetNo: 3,
      itemCode: "AVIO-BOARD-01",
      serialNumber: "AVIO-SN-0003",
      qty: 1,
      uom: "NOS",
      batchNo: "BATCH-AVIO-001",
      colour: "YELLOW",
      status: PacketTagStatus.COMMISSIONED,
    },

    // Line I: 3 HYDRA serialized
    {
      epc: "EPC-HAL-HYD-001",
      lineKey: "L_I",
      packetNo: 1,
      itemCode: "HYDRA-VALVE-01",
      serialNumber: "HYD-SN-0001",
      qty: 1,
      uom: "NOS",
      batchNo: "BATCH-HYD-001",
      colour: "PURPLE",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-HYD-002",
      lineKey: "L_I",
      packetNo: 2,
      itemCode: "HYDRA-VALVE-01",
      serialNumber: "HYD-SN-0002",
      qty: 1,
      uom: "NOS",
      batchNo: "BATCH-HYD-001",
      colour: "PURPLE",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-HYD-003",
      lineKey: "L_I",
      packetNo: 3,
      itemCode: "HYDRA-VALVE-01",
      serialNumber: "HYD-SN-0003",
      qty: 1,
      uom: "NOS",
      batchNo: "BATCH-HYD-001",
      colour: "PURPLE",
      status: PacketTagStatus.COMMISSIONED,
    },

    // Line O: 2 test packets
    {
      epc: "EPC-HAL-TEST-001",
      lineKey: "L_O",
      packetNo: 1,
      itemCode: "NUT-M10-500",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-NUT-008",
      colour: "GREEN",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-TEST-002",
      lineKey: "L_O",
      packetNo: 2,
      itemCode: "NUT-M10-500",
      qty: 100,
      uom: "NOS",
      batchNo: "BATCH-NUT-008",
      colour: "GREEN",
      status: PacketTagStatus.COMMISSIONED,
    },

    // Real HAL Balance Weight
    {
      epc: "EPC-HAL-BW-001",
      lineKey: "L_HAL33",
      packetNo: 1,
      itemCode: "21313096",
      qty: 20,
      uom: "NO",
      batchNo: "LOT-6018",
      colour: "ORANGE",
      status: PacketTagStatus.COMMISSIONED,
    },
    {
      epc: "EPC-HAL-BW-002",
      lineKey: "L_HAL33",
      packetNo: 2,
      itemCode: "21313096",
      qty: 20,
      uom: "NO",
      batchNo: "LOT-6018",
      colour: "ORANGE",
      status: PacketTagStatus.COMMISSIONED,
    },
  ];

  const preTagged: Record<string, { id: bigint; rrLineId: bigint }> = {};
  for (const def of preTaggedDefs) {
    const line = lines[def.lineKey]!;
    const t = await prisma.packetTag.upsert({
      where: { epc: def.epc },
      update: { status: def.status },
      create: {
        epc: def.epc,
        rrLineId: line.id,
        packetNo: def.packetNo,
        itemCode: def.itemCode,
        serialNumber: def.serialNumber ?? null,
        qty: new Prisma.Decimal(def.qty),
        uom: def.uom,
        batchNo: def.batchNo,
        colour: def.colour,
        materialType: "STEEL",
        tagType: "RFID",
        status: def.status,
        printStatus: PrintStatus.PRINTED,
        taggedBy: adminUserId,
      },
    });
    preTagged[def.epc] = { id: t.id, rrLineId: t.rrLineId };

    await prisma.baseline.upsert({
      where: { packetTagId: t.id },
      update: {},
      create: {
        packetTagId: t.id,
        method: COUNTING_METHODS.MANUAL,
        baselineCount: new Prisma.Decimal(def.qty),
        ifsQtyAtCount: new Prisma.Decimal(def.qty),
        varianceFlag: false,
        notes: "Seed baseline",
      },
    });
  }
  console.log(`   ✅ ${preTaggedDefs.length} pre-tagged packets ready with baselines`);

  // ═══════════════════════════════════════════════════════════════
  // 7️⃣ WORKFLOW DATA (Transfers, CountChecks, Put-Away, Binning, Stock, Alerts, Variance, Audit, IFS Sync)
  // ═══════════════════════════════════════════════════════════════
  console.log("📌 [7/7] Seeding related workflow and lookup records...");

  const seedPacketEntries = Object.values(preTagged).slice(0, 8);
  const seedPacketIds = seedPacketEntries.map((packet) => packet.id);

  // ─── Count Checks (Holding) ───
  await prisma.countCheck.deleteMany({ where: { packetTagId: { in: seedPacketIds } } });
  for (const [index, packet] of seedPacketEntries.entries()) {
    const baseline = await prisma.baseline.findUnique({ where: { packetTagId: packet.id } });
    if (!baseline) continue;
    const count = new Prisma.Decimal(index === 4 ? 98 : 100);
    await prisma.countCheck.create({
      data: {
        packetTagId: packet.id,
        baselineId: baseline.id,
        actualCount: count,
        baselineCount: baseline.baselineCount,
        matchesBaseline: index !== 4,
        varianceAmount: index === 4 ? new Prisma.Decimal(-2) : new Prisma.Decimal(0),
        withinTolerance: index !== 4,
        managerOverride: index === 4,
        overrideNotes: index === 4 ? "Seeded variance review" : null,
        checkedBy: adminUserId,
      },
    });
  }

  // ─── Storage Confirmations (Put-Away) ───
  await prisma.storageConfirmation.deleteMany({ where: { packetTagId: { in: seedPacketIds } } });
  const seededBins = await prisma.bin.findMany({ orderBy: { id: "asc" }, take: 10 });
  for (const [index, packet] of seedPacketEntries.entries()) {
    const bin = seededBins[index]!;
    await prisma.storageConfirmation.create({
      data: {
        packetTagId: packet.id,
        binRfidEpc: bin.binRfid,
        ifsLocationNo: locationDefs[index % locationDefs.length]![0],
        warehouse: index < 4 ? "WH-01" : "WH-02",
        binNo: bin.code,
        confirmedBy: adminUserId,
        syncedFromDevice: "HANDHELD-MC33XR-01",
      },
    });
  }

  // ─── Alerts (at least 8 distinct alerts) ───
  await prisma.alert.deleteMany({ where: { ref: { startsWith: "SEED-" } } });
  const alertAreas = [
    "TRANSIT_ANOMALY",
    "HOLDING_MISMATCH",
    "COUNT_VARIANCE",
    "TAG_MISMATCH",
    "STOCK_DISCREPANCY",
    "WRONG_BIN_PLACEMENT",
    "GATE_SECURITY",
    "QC_HOLD",
  ];
  await prisma.alert.createMany({
    data: alertAreas.map((area, index) => ({
      alertType: area.includes("SECURITY") ? "SECURITY" : "WORKFLOW",
      type: area,
      severity:
        index === 0 || index === 6
          ? AlertSeverity.CRITICAL
          : index % 2 === 0
            ? AlertSeverity.WARNING
            : AlertSeverity.INFO,
      ref: `SEED-ALERT-${index + 1}`,
      message: `System alert for ${area.toLowerCase().replace(/_/g, " ")}`,
      status:
        index === 3 || index === 7
          ? AlertStatus.ACKNOWLEDGED
          : index === 5
            ? AlertStatus.RESOLVED
            : AlertStatus.OPEN,
      recipientRoles: [
        ROLES.ADMIN,
        ROLES.SECURITY,
        ROLES.TRANSIT_MANAGER,
        ROLES.HOLDING_MANAGER,
      ].join(","),
      sourceFn: "seed-sits",
      acknowledgedBy: index === 3 || index === 7 ? adminUserId : null,
      acknowledgedAt: index === 3 || index === 7 ? new Date() : null,
      resolvedAt: index === 5 ? new Date() : null,
    })),
  });

  // ─── Variances (at least 6 records) ───
  await prisma.variance.deleteMany({ where: { ref: { startsWith: "SEED-VARIANCE-" } } });
  const varianceContexts = ["COUNT", "WEIGHT", "REEL", "TRANSFER", "STOCK", "PUT_AWAY"];
  await prisma.variance.createMany({
    data: varianceContexts.map((context, index) => ({
      context,
      ref: `SEED-VARIANCE-${index + 1}`,
      expectedQty: new Prisma.Decimal(100 + index * 10),
      actualQty: new Prisma.Decimal(98 + index * 10),
      varianceAmount: new Prisma.Decimal(-2),
      disposition: index % 2 === 0 ? VarianceDisposition.ACCEPTED : VarianceDisposition.PENDING,
      raisedBy: adminUserId,
      resolvedBy: index % 2 === 0 ? adminUserId : null,
      resolvedAt: index % 2 === 0 ? new Date() : null,
      notes: `Seeded variance investigation for ${context}`,
    })),
  });

  // ─── Audit Logs (at least 10 records) ───
  await prisma.auditLog.deleteMany({ where: { resource: "SEED_WORKFLOW" } });
  const auditResources = [
    "RR",
    "LINE_COUNT",
    "TAG",
    "TRANSFER",
    "BINNING",
    "DEVICE",
    "PUT_AWAY",
    "COUNT_CHECK",
    "STOCK_VERIFICATION",
    "VARIANCE",
  ];
  await prisma.auditLog.createMany({
    data: auditResources.map((resource, index) => ({
      userId: adminUserId,
      action: `${resource.toLowerCase()}.seed`,
      screen: `GET /api/v1/${resource.toLowerCase().replace(/_/g, "-")}`,
      resource: "SEED_WORKFLOW",
      resourceId: `SEED-${resource}-${index + 1}`,
      description: `Seeded audit record for ${resource.toLowerCase()}`,
      result: AuditResult.SUCCESS,
      metadata: { source: "seed-sits", resource, index },
    })),
  });

  // ─── Binning Plans & Lines & Downloads & Confirmations & Sync Logs ───
  const binningPlans: Array<{ id: bigint; planId: string }> = [];
  for (let index = 0; index < 6; index += 1) {
    const planId = `SEED-PLAN-${String(index + 1).padStart(2, "0")}`;
    const status =
      index === 0
        ? BinningPlanStatus.ACTIVE
        : index === 1
          ? BinningPlanStatus.COMPLETED
          : BinningPlanStatus.DRAFT;
    const plan = await prisma.binningPlan.upsert({
      where: { planId },
      update: { status, fetchedBy: adminUserId },
      create: {
        planId,
        version: 1,
        status,
        source: "IFS",
        fetchedBy: adminUserId,
        activatedAt:
          status === BinningPlanStatus.ACTIVE || status === BinningPlanStatus.COMPLETED
            ? new Date()
            : null,
        notes: `Seeded binning plan ${index + 1}`,
      },
    });
    binningPlans.push({ id: plan.id, planId });

    await prisma.binningPlanLine.deleteMany({ where: { planId: plan.id } });
    await prisma.binningPlanLine.createMany({
      data: seedPacketEntries.slice(0, 5).map((packet, lineIndex) => ({
        planId: plan.id,
        lineNo: lineIndex + 1,
        rrLineId: packet.rrLineId,
        packetTagId: packet.id,
        itemCode: "NUT-M10-500",
        expectedQty: new Prisma.Decimal(100),
        binId: seededBins[lineIndex]!.code,
        positionId: `POS-${index + 1}-${lineIndex + 1}`,
        locationTagId: seededBins[lineIndex]!.binRfid,
        status:
          status === BinningPlanStatus.COMPLETED ||
          (status === BinningPlanStatus.ACTIVE && lineIndex === 0)
            ? BinningPlanLineStatus.COMPLETED
            : BinningPlanLineStatus.PENDING,
      })),
    });
  }

  // ─── Stock Verification Runs (at least 6 runs) ───
  const stockDevice = "HANDHELD-MC33XR-01";
  await prisma.stockVerificationRun.deleteMany({
    where: { runRef: { startsWith: "SEED-STOCK-" } },
  });
  for (let index = 0; index < 6; index += 1) {
    const run = await prisma.stockVerificationRun.create({
      data: {
        runRef: `SEED-STOCK-${index + 1}`,
        trigger:
          index % 3 === 0
            ? StockVerificationTrigger.MANUAL
            : index % 3 === 1
              ? StockVerificationTrigger.DEVICE
              : StockVerificationTrigger.SCHEDULED,
        locationNo: locationDefs[index % locationDefs.length]![0],
        warehouse: index < 3 ? "WH-01" : "WH-02",
        binRfidEpc: seededBins[index % seededBins.length]!.binRfid,
        deviceId: stockDevice,
        operatorId: adminUserId,
        offline: index === 1,
        syncedAt: new Date(),
        foundCount: 2,
        notFoundCount: index === 4 ? 1 : 0,
        extraCount: index === 5 ? 1 : 0,
        status: StockVerificationStatus.COMPLETED,
      },
    });
    await prisma.stockVerificationLine.createMany({
      data: [
        {
          runId: run.id,
          outcome: StockVerificationOutcome.FOUND,
          itemCode: "NUT-M10-500",
          itemDesc: "Steel Nut M10",
          lotBatchNo: "BATCH-NUT-001",
          epc: `EPC-HAL-NUT-00${(index % 5) + 1}`,
          packetTagId: seedPacketEntries[index % seedPacketEntries.length]!.id,
          qtyFound: new Prisma.Decimal(100),
          qtyExpected: new Prisma.Decimal(100),
          varianceQty: new Prisma.Decimal(0),
          note: "Found matching tag in expected bin",
        },
        {
          runId: run.id,
          outcome:
            index === 4 ? StockVerificationOutcome.NOT_FOUND : StockVerificationOutcome.FOUND,
          itemCode: "BOLT-M12",
          itemDesc: "Steel Bolt M12",
          lotBatchNo: "BATCH-BOLT-001",
          epc: `EPC-HAL-BOLT-001`,
          packetTagId: seedPacketEntries[1]!.id,
          qtyFound: new Prisma.Decimal(index === 4 ? 0 : 100),
          qtyExpected: new Prisma.Decimal(100),
          varianceQty: new Prisma.Decimal(index === 4 ? -100 : 0),
          note: index === 4 ? "Missing packet during physical scan" : "Verified",
        },
      ],
    });
  }

  // ─── IFS Gate Entry Sync States & Config ───
  for (const gateEntryNo of [
    "2411001",
    "2411002",
    "2411003",
    "2411004",
    "2411005",
    "2411006",
    "1001",
    "1002",
  ]) {
    await prisma.ifsGateEntrySyncState.upsert({
      where: { gateEntryNo },
      update: {
        status: IFS_GATE_ENTRY_SYNC_STATE.SYNCED,
        lastSyncedAt: new Date(),
        lastError: null,
      },
      create: { gateEntryNo, status: IFS_GATE_ENTRY_SYNC_STATE.SYNCED, lastSyncedAt: new Date() },
    });
  }

  await prisma.ifsPollingConfig.upsert({
    where: { configKey: "default" },
    update: { enabled: true },
    create: { configKey: "default", enabled: true, normalIntervalMs: 300000 },
  });

  await prisma.ifsSyncState.upsert({
    where: { stateKey: "polling" },
    update: { status: IFS_POLL_STATE.RUNNING, currentIntervalMs: 300000 },
    create: { stateKey: "polling", status: IFS_POLL_STATE.RUNNING, currentIntervalMs: 300000 },
  });

  for (const resource of [
    "GATE_ENTRY_HEADER",
    "GATE_ENTRY_DETAIL",
    "INVENTORY_PART",
    "INVENTORY_PART_LOCATION",
    "INVENTORY_PART_STOCK",
  ]) {
    await prisma.ifsSyncWatermark.upsert({
      where: { resource },
      update: { status: IFS_WATERMARK_STATUS.HEALTHY, lastSyncedAt: new Date() },
      create: { resource, status: IFS_WATERMARK_STATUS.HEALTHY, lastSyncedAt: new Date() },
    });
  }

  // ─── Sample Transfers (at least 6 transfers) ───
  const demoEpcs = ["EPC-HAL-NUT-001", "EPC-HAL-NUT-002", "EPC-HAL-BOLT-001", "EPC-HAL-AVIO-001"];
  const transferDefs = [
    ["TRF-2025-DEMO-01", TransferStatus.IN_TRANSIT],
    ["TRF-2025-DEMO-02", TransferStatus.CREATED],
    ["TRF-2025-DEMO-03", TransferStatus.PARTIAL_RECEIVED],
    ["TRF-2025-DEMO-04", TransferStatus.RECEIVED],
    ["TRF-2025-DEMO-05", TransferStatus.IN_TRANSIT],
    ["TRF-2025-DEMO-06", TransferStatus.CREATED],
  ] as Array<[string, TransferStatus]>;

  for (const [transferId, status] of transferDefs) {
    const transfer = await prisma.transfer.upsert({
      where: { transferId },
      update: { status, toLocation: "HOLDING_1" },
      create: {
        transferId,
        status,
        fromLocation: "TRANSIT",
        toLocation: "HOLDING_1",
        createdBy: adminUserId,
        dispatchedAt: new Date(),
        receivedAt: status === TransferStatus.RECEIVED ? new Date() : null,
      },
    });
    await prisma.transferLine.deleteMany({ where: { transferId: transfer.id } });
    await prisma.transferLine.createMany({
      data: demoEpcs.map((epc, index) => ({
        transferId: transfer.id,
        packetTagId: preTagged[epc]!.id,
        rrLineId: preTagged[epc]!.rrLineId,
        epc,
        isReceived:
          status === TransferStatus.RECEIVED ||
          (status === TransferStatus.PARTIAL_RECEIVED && index === 0),
        receivedAt:
          status === TransferStatus.RECEIVED ||
          (status === TransferStatus.PARTIAL_RECEIVED && index === 0)
            ? new Date()
            : null,
        receivedQty:
          status === TransferStatus.RECEIVED ||
          (status === TransferStatus.PARTIAL_RECEIVED && index === 0)
            ? new Prisma.Decimal(100)
            : null,
      })),
    });
  }
  console.log(`   ✅ ${transferDefs.length} demo transfers ready`);

  console.log("");
  console.log("SITS project seed complete.");
}

main()
  .catch((err) => {
    console.error("SITS project seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
