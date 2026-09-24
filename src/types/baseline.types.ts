import type { CountingMethod } from "../constants/device-types.js";

export interface BaselineDto {
  id: string;
  packetTagId: string;
  method: string;
  unitWeight: number | null;
  totalWeight: number | null;
  baselineCount: number;
  ifsQtyAtCount: number;
  varianceFlag: boolean;
  varianceAmount: number | null;
  deviceId: string | null;
  countedBy: string | null;
  countedAt: Date;
  notes: string | null;
}

export interface CaptureBaselineInput {
  packetTagId: string;
  method: CountingMethod;
  manualCount?: number;
  unitWeight?: number;
  totalWeight?: number;
  reelReading?: number;
  deviceId?: string;
  notes?: string;
}

export interface CaptureBaselineResult {
  baseline: BaselineDto;
  variance: {
    hasVariance: boolean;
    amount: number;
  };
  alertRaised: boolean;
}
