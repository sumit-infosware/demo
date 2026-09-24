import type { CountingMethod } from "../constants/device-types.js";

export interface CaptureCountCheckInput {
  packetTagId: string;
  method?: CountingMethod;
  manualCount?: number;
  unitWeight?: number;
  totalWeight?: number;
  reelReading?: number;
  deviceId?: string;
  managerOverride?: boolean;
  overrideNotes?: string;
}

export interface CountCheckDto {
  id: string;
  packetTagId: string;
  baselineId: string;
  actualCount: number;
  baselineCount: number;
  matchesBaseline: boolean;
  varianceAmount: number | null;
  withinTolerance: boolean;
  managerOverride: boolean;
  overrideNotes: string | null;
  deviceId: string | null;
  checkedBy: string | null;
  checkedAt: Date;
}

export interface CountCheckResult {
  countCheck: CountCheckDto;
  match: boolean;
  withinTolerance: boolean;
  varianceAmount: number;
  requiresOverride: boolean;
  alertRaised: boolean;
}
