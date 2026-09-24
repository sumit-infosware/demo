import type { TransferStatus } from "../enums/status.enum.js";

export interface HoldingScanInput {
  deviceId: string;
  transferId: string;
  scannedEpcs: string[];
}

export interface HoldingScanResult {
  transferId: string;
  totalExpected: number;
  foundEpcs: string[];
  missingEpcs: string[];
  extraEpcs: string[];
  isFullyReceived: boolean;
}

export interface HoldingReceiveInput {
  transferId: string;
  receivedItems: Array<{
    epc: string;
    receivedQty?: number;
  }>;
  notes?: string;
}

export interface HoldingReceiveResult {
  transferId: string;
  status: TransferStatus; // "RECEIVED" | "PARTIAL_RECEIVED"
  receivedCount: number;
  missingCount: number;
  alertRaised: boolean;
}

export interface ReconcileAlternateInput {
  packetTagId: string;
  ifsUpdatedItemCode: string;
}

export interface ReconcileAlternateResult {
  packetTagId: string;
  orderedItemCode: string;
  taggedItemCode: string;
  ifsItemCode: string;
  isMatch: boolean;
  reconciledAt: Date;
}
