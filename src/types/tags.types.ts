import type { ColourCategory } from "../enums/status.enum.js";

export interface PacketTagDto {
  id: string;
  epc: string;
  rrLineId: string;
  packetNo: number;
  batchNo: string | null;
  colour: string | null;
  itemCode: string;
  originalItemCode: string | null;
  isAlternate: boolean;
  qty: number;
  uom: string;
  status: string;
  taggedBy: string | null;
  taggedAt: Date;
  tagType: string;
  serialNumber: string | null;
  barcode: string | null;
  materialType: string | null;
  isVoided: boolean;
  voidReason: string | null;
  voidedAt: Date | null;
}

export interface LabelPayload {
  epc: string;
  barcode: string;
  itemCode: string;
  itemDesc: string | null;
  qty: number;
  uom: string;
  batchNo: string | null;
  colour: string | null;
  packetNo: number;
  rrNo: string;
  lineNo: string;
}

export interface TaggingSessionResponse {
  rrLineId: string;
  orderedItem: string;
  taggedAsItem: string;
  isAlternate: boolean;
  totalPacketsExpected: number;
  totalPacketsTagged: number;
  packetsCreatedInThisCall: PacketTagDto[];
}

export interface AvailableColour {
  code: string;
  displayName: string;
  colours: string[];
  category: ColourCategory;
}

export interface GenerateTagInput {
  rrLineId: string;
  packetIndex: number;
  totalPackets: number;
  packetQty: number;
  colour: string;
  serialNumber?: string;
  alternateItemCode?: string;
  tagType?: string;
  /** 🆕 If photos were captured before tag creation via /handheld/photo-request */
  photoRequestId?: string;
}

export interface GenerateTagResult {
  tagId: string;
  epc: string;
  barcode: string;
  labelPayload: LabelPayloadV2;
  printCommand: {
    printerId: string;
    copies: number;
    encodeRfid: boolean;
    zplTemplate?: string;
  };
}

export interface LabelPayloadV2 {
  epc: string;
  barcode: string;
  itemCode: string;
  itemDesc: string | null;
  qty: number;
  uom: string;
  batchNo: string | null;
  serialNumber: string | null;
  colour: string;
  packetNo: string;
  rrNo: string;
  vendorName: string | null;
  materialType: string | null;
}
