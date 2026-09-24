/**
 * Types for the Transit Door Read module (RF-26, RF-27, RF-28).
 *
 * Gate reader at the transit door reads departing RFID tags.
 * Each EPC is checked against Redis for a TID (tid:{epc}).
 * - TID exists → AUTHORIZED
 * - no TID, tag is barcode-only (tagType BARCODE_ONLY) → EXEMPT
 * - no TID otherwise → UNAUTHORIZED (CRITICAL alarm + EventLog)
 */

export type TransitDoorEpcStatus = "AUTHORIZED" | "UNAUTHORIZED" | "EXEMPT";

export interface TransitDoorEpcResult {
  epc: string;
  hasTid: boolean;
  status: TransitDoorEpcStatus;
  /** Why the EPC was EXEMPT (e.g. "barcode-only tag"); absent otherwise. */
  reason?: string;
}

export interface TransitDoorReadInput {
  deviceId: string;
  epcs: string[];
}

export interface TransitDoorReadResult {
  totalTags: number;
  authorized: number;
  unauthorized: number;
  exempt: number;
  results: TransitDoorEpcResult[];
}
