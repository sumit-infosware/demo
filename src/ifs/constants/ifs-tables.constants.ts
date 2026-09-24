/**
 * IFS table and view names from the external read-only MySQL demo/production database.
 */
export const IFS_TABLES = {
  GATE_ENTRY_HEADER: "gate_entry_header",
  GATE_ENTRY_DETAIL: "gate_entry_details",
  PART_CATALOG: "part_catalog",
  INVENTORY_PART: "inventory_part",
  INVENTORY_PART_LOCATION: "inventory_part_location",
  INVENTORY_STOCK: "INVENTORY_STOCK",
  CHARGE_STATUS_VIEW: "IFS_CHARGE_STATUS_VIEW",
} as const;

export type IfsTableName = (typeof IFS_TABLES)[keyof typeof IFS_TABLES];
