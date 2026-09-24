/**
 * SITS application/business status enums.
 *
 * These values belong to the SITS domain.
 * Do not put IFS-specific status values in this file — the IFS vocabularies
 * (IFS_LINE_STATUS, PO_OWNERSHIP, IFS_POLL_STATE, IFS_GATE_ENTRY_SYNC_STATE,
 * IFS_WATERMARK_STATUS) live in `src/ifs/enums/`.
 *
 * Cross-domain duplicates are intentionally NOT declared here:
 * - QcStatus            → use IFS_LINE_STATUS (src/ifs/enums/ifs-qc-status.enum.js).
 * - PoOwnership         → use PO_OWNERSHIP (src/ifs/enums/ifs-sync-status.enum.js).
 * - CountingMethod      → use COUNTING_METHODS (src/constants/device-types.ts).
 * - ChargStatus         → live type in src/types/transit-exit.types.ts.
 */

// RR
export enum RrStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

// RR Line
export enum RrLineCategory {
  STANDARD = "STANDARD",
  REPAIR = "REPAIR",
  RETURN = "RETURN",
  RAW = "RAW",
  OUTSOURCED = "OUTSOURCED",
}

/** SITS RR_LINE.itemType — derived during IFS sync (serialized vs bulk). */
export enum ItemType {
  BULK = "BULK",
  SERIALIZED = "SERIALIZED",
}

/** SITS workflow ownership of an RR line (set manually, distinct from IFS-derived poOwnership). */
export enum Ownership {
  HAL = "HAL",
  OTHER = "OTHER",
}

export enum RrLineStatus {
  OPEN = "OPEN",
  COUNTED = "COUNTED",
  QC_ACCEPTED = "QC_ACCEPTED",
  TAGGING = "TAGGING",
  TAGGED = "TAGGED",
  TRANSFERRED = "TRANSFERRED",
  RECEIVED = "RECEIVED",
}

// Packet Tag
export enum PacketTagStatus {
  CREATED = "CREATED",
  COMMISSIONED = "COMMISSIONED",
  PRINTED = "PRINTED",
  LABEL_PRINTED = "LABEL_PRINTED",
  SENT_TO_HOLDING = "SENT_TO_HOLDING",
  RECEIVED_AT_HOLDING = "RECEIVED_AT_HOLDING",
  VOIDED = "VOIDED",
  TRANSIT_OUT = "TRANSIT_OUT",
  STORED = "STORED",
}

export enum PrintStatus {
  PENDING = "PENDING",
  PRINTED = "PRINTED",
  FAILED = "FAILED",
}

export enum ColourCategory {
  SINGLE = "SINGLE",
  DUAL = "DUAL",
  TRIPLE = "TRIPLE",
}

// Variance
export enum VarianceDisposition {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  REWORK = "REWORK",
}

// Transfer
export enum TransferStatus {
  CREATED = "CREATED",
  IN_TRANSIT = "IN_TRANSIT",
  RECEIVED = "RECEIVED",
  PARTIAL_RECEIVED = "PARTIAL_RECEIVED",
  PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED",
  RECEIVED_AT_HOLDING = "RECEIVED_AT_HOLDING",
  CANCELLED = "CANCELLED",
}

// Stock Verification
export enum StockVerificationTrigger {
  MANUAL = "MANUAL",
  SCHEDULED = "SCHEDULED",
  DEVICE = "DEVICE",
}

export enum StockVerificationOutcome {
  FOUND = "FOUND",
  NOT_FOUND = "NOT_FOUND",
  EXTRA = "EXTRA",
}

export enum StockVerificationStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

// Binning
export enum BinningPlanStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  PLANNED = "PLANNED",
  DOWNLOADED = "DOWNLOADED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum BinningPlanLineStatus {
  PENDING = "PENDING",
  ASSIGNED = "ASSIGNED",
  CONFIRMED = "CONFIRMED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum PlanDownloadStatus {
  PENDING = "PENDING",
  DOWNLOADED = "DOWNLOADED",
  SYNCED = "SYNCED",
  FAILED = "FAILED",
}

export enum PlacementConfirmationStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  FAILED = "FAILED",
  MISMATCH = "MISMATCH",
}

/** SyncLog (RF-42) lifecycle status. */
export enum SyncLogStatus {
  IN_PROGRESS = "IN_PROGRESS",
  CONFLICT = "CONFLICT",
  PARTIAL = "PARTIAL",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/** Per-item result status returned by a binning sync run (RF-42). */
export enum SyncResultStatus {
  SYNCED = "SYNCED",
  ALREADY_SYNCED = "ALREADY_SYNCED",
  CONFLICT = "CONFLICT",
  FAILED = "FAILED",
}

/** Handheld photo-request lifecycle (in-memory, src/services/handheld.service.ts). */
export enum PhotoRequestStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  CONSUMED = "CONSUMED",
}
