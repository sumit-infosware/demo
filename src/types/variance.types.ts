import type { VarianceDisposition } from "../enums/status.enum.js";

export interface VarianceDto {
  id: string;
  context: string;
  ref: string;
  expectedQty: number | null;
  actualQty: number | null;
  varianceAmount: number | null;
  disposition: string;
  raisedBy: string | null;
  raisedAt: Date;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  notes: string | null;
}

export type VarianceContext = "BASELINE" | "COUNT_CHECK" | "HOLDING_RECEIVE";
export type Disposition = VarianceDisposition;
