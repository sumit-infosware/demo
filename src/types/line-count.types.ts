import type { CountingMethod } from "../constants/device-types.js";

export type { CountingMethod };

export interface CaptureLineCountInput {
  rrLineId: string;
  method: CountingMethod;
  numPackages: number;
  qtyPerPackage: number;
  manualCount?: number | null;
  unitWeightG?: number | null;
  totalWeightG?: number | null;
  reelReadingMtr?: number | null;
  pitchMm?: number | null;
  operatorEditedQty?: number | null;
  deviceId?: string | null;
  notes?: string | null;
}

export interface LineCountDto {
  id: string;
  rrLineId: string;
  method: string;
  numPackages: number;
  qtyPerPackage: number;
  unitWeightG: number | null;
  totalWeightG: number | null;
  reelReadingMtr: number | null;
  pitchMm: number | null;
  calculatedQty: number;
  operatorEditedQty: number | null;
  finalCountedQty: number;
  ifsChallanQty: number;
  varianceQty: number;
  varianceFlag: boolean;
  deviceId: string | null;
  countedBy: string | null;
  countedAt: Date;
  notes: string | null;
}

export interface CaptureLineCountResult {
  lineCount: LineCountDto;
  variance: { hasVariance: boolean; amount: number };
  alertRaised: boolean;
  canProceedToTagging: boolean;
}
