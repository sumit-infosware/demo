export interface TransferDto {
  transferId: string;
}

export interface TagDetailsDto {
  epc: string;
  tag: {
    tagId: string;
    epc: string;
    tagType: string;
    packetNo: number;
    status: string;
    serialNumber: string | null;
    barcode: string | null;
    qty: string;
    uom: string;
    batchNo: string | null;
    colour: string | null;
    materialType: string | null;
    isVoided: boolean;
  };
  asset: {
    assetId: string;
    itemCode: string;
    itemDescription: string | null;
    category: string | null;
    acceptedQty: string | null;
    receivedQty: string | null;
    orderedQty: string | null;
    stockingUom: string | null;
    ownership: string | null;
  };
}

export interface SyncHierarchyBinDto {
  binId: string;
  binNo: string;
  binRfid: string;
}

export interface SyncHierarchyTierDto {
  tierId: string;
  tierNo: string;
  tierRfid: string;
  bins: SyncHierarchyBinDto[];
}

export interface SyncHierarchyRowDto {
  rowId: string;
  rowNo: string;
  tiers: SyncHierarchyTierDto[];
}

export interface SyncHierarchyBayDto {
  bayId: string;
  bayNo: string;
  rows: SyncHierarchyRowDto[];
}

export interface SyncHierarchyStorageDto {
  warehouseId: string;
  warehouseNo: string;
  bays: SyncHierarchyBayDto[];
}

export interface FlatTagDetailsDto {
  tagId: string;
  epc: string;
  tagType: string;
  packetNo: number;
  status: string;
  serialNumber: string | null;
  barcode: string | null;
  qty: string;
  isVoided: boolean;
  itemId: string;
  itemCode: string;
  itemDescription: string | null;
  acceptedQty: string | null;
  receivedQty: string | null;
  orderedQty: string | null;
  ownership: string | null;
}

export interface TransferItemDetailsDto {
  packageTagId: string;
  epc: string;
  qty: string;
}

export interface TransferItemGroupDto {
  ItemNo: string;
  locationId: string;
  locationNo: string;
  ItemDetails: TransferItemDetailsDto[];
}
