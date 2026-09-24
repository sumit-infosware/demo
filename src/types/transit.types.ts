export type TransitEpcStatus = "FOUND" | "UNKNOWN";

export interface TransitEpcResult {
  epc: string;
  status: TransitEpcStatus;
}

export interface TransitReadInput {
  readerId?: string;
  port?: number;
  /** Optional transfer reference — when set, the read is checked against the Transfer's approved line EPCs. */
  transferId?: string;
  epcs: string[];
}

export interface TransitReadResult {
  totalRead: number;
  uniqueRead: number;
  matched: number;
  unknown: number;
  duplicates: number;
  /**
   * True when a completeness baseline (transferId) was available and some
   * expected EPCs are still missing. Always false when no transferId was
   * provided (raw first read before a TID exists).
   */
  requiresRescan: boolean;
  /** Transfer the read was checked against; null when none was supplied. */
  transferId: string | null;
  /**
   * Completeness of the read vs the transfer's expected EPCs.
   * null when no transferId was supplied (no completeness claim is made).
   */
  complete: boolean | null;
  /** Expected EPCs not present in this read (only set when transferId supplied). */
  missingEpcs: string[];
  epcs: TransitEpcResult[];
}
