/**
 * RF-37: Fetch Bin/Position Plan
 * RF-38: Download plan to handheld
 * Type definitions for binning plan data structures
 */
import type { PlacementConfirmationStatus, SyncResultStatus } from "../enums/status.enum.js";

export interface BinningPlanLineDto {
  id: string;
  lineNo: number;
  rrLineId: string | null;
  packetTagId: string | null;
  itemCode: string;
  expectedQty: number;
  binId: string;
  positionId: string | null;
  locationTagId: string | null;
  status: string;
  notes: string | null;
}

export interface BinningPlanDto {
  id: string;
  planId: string;
  version: number;
  status: string;
  source: string;
  fetchedAt: Date;
  activatedAt: Date | null;
  lines: BinningPlanLineDto[];
  totalLines: number;
  completedLines: number;
  pendingLines: number;
}

/**
 * RF-38: Plan Download DTOs
 */
export interface PlanDownloadDto {
  id: string;
  planId: string;
  deviceId: string;
  downloadedAt: Date;
  downloadedBy: string | null;
  status: string;
  syncedAt: Date | null;
  expiresAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanSyncStateDto {
  id: string;
  planId: string;
  deviceId: string;
  lastSyncedAt: Date;
  lastConfirmedAt: Date | null;
  pendingConfirmations: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DownloadPlanRequest {
  deviceId: string;
  expiresInHours?: number;
}

export interface DownloadPlanResponse {
  download: PlanDownloadDto;
  plan: BinningPlanDto;
}

/**
 * RF-39: Find Location DTOs
 *
 * Locations are resolved natively against the storage hierarchy
 * (Warehouse → Bay → Row → Tier → Bin). Scans match binRfid first, then
 * tierRfid as fallback.
 */
export interface LocationMappingDto {
  binId: string | null;
  binCode: string | null;
  binRfid: string | null;
  binName: string | null;
  tierCode: string | null;
  tierRfid: string | null;
  tierName: string | null;
  rowCode: string | null;
  bayCode: string | null;
  warehouseCode: string | null;
}

export interface FindLocationPlanLineDto {
  id: string;
  planId: string;
  lineNo: number;
  itemCode: string;
  expectedQty: number;
  binId: string;
  positionId: string | null;
  locationTagId: string | null;
  status: string;
  notes: string | null;
}

export interface FindLocationResultDto {
  location: LocationMappingDto;
  planLine?: FindLocationPlanLineDto | null;
}

/**
 * RF-40: Place & Verify DTOs
 */
export interface PlacementConfirmationDto {
  id: string;
  planLineId: string;
  packetTagId: string;
  expectedLocationTagId: string;
  actualLocationTagId: string | null;
  expectedBinId: string;
  expectedPositionId: string | null;
  actualBinId: string | null;
  actualPositionId: string | null;
  status: string;
  mismatchReason: string | null;
  deviceId: string;
  operatorId: string;
  isOffline: boolean;
  confirmedAt: Date;
  syncedAt: Date | null;
  syncLogId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A resolved slot in the storage hierarchy used in place/verify responses. */
export interface PlaceAndVerifySlotInfoDto {
  binId: string | null;
  binCode: string | null;
  binRfid: string | null;
  tierCode: string | null;
  tierRfid: string | null;
  rowCode: string | null;
  bayCode: string | null;
  warehouseCode: string | null;
}

export interface PlaceAndVerifyRequest {
  packetEpc?: string;
  packetTagId?: string;
  locationTagId?: string;
  binId?: string;
  positionId?: string;
  planId?: string;
  deviceId: string;
  isOffline?: boolean;
  confirmedAt?: Date;
  notes?: string;
}

export interface PlaceAndVerifyResponse {
  verified: boolean;
  status: PlacementConfirmationStatus;
  message: string;
  expectedLocation: PlaceAndVerifySlotInfoDto;
  actualLocation?: PlaceAndVerifySlotInfoDto | null;
  mismatchReason?: string | null;
  confirmation?: PlacementConfirmationDto | null;
}

/**
 * RF-42: Sync on Re-dock DTOs
 */
export interface SyncItemInput {
  packetEpc?: string;
  packetTagId?: string;
  binId?: string;
  positionId?: string;
  locationTagId?: string;
  confirmedAt?: Date;
  notes?: string;
}

export interface SyncRedockRequest {
  deviceId: string;
  planId?: string;
  planVersion?: number;
  confirmations: SyncItemInput[];
}

export interface SyncItemResultDto {
  packetEpc?: string;
  packetTagId?: string;
  status: SyncResultStatus;
  message: string;
  confirmationId?: string;
  expectedLocation?: PlaceAndVerifySlotInfoDto | null;
  actualLocation?: PlaceAndVerifySlotInfoDto | null;
  mismatchReason?: string | null;
}

export interface SyncLogDto {
  id: string;
  deviceId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  confirmationsUploaded: number;
  conflictsDetected: number;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncRedockResponse {
  syncLog: SyncLogDto;
  totalProcessed: number;
  confirmationsUploaded: number;
  conflictsDetected: number;
  alreadySyncedCount: number;
  failedCount: number;
  results: SyncItemResultDto[];
  planSyncState?: PlanSyncStateDto | null;
}

/**
 * RF-37 (manual import): Plan Import / Activate DTOs
 */
export interface ImportBinningPlanLineInput {
  lineNo?: number;
  itemCode: string;
  expectedQty: number;
  binCode: string;
  notes?: string | null;
}

export interface ImportBinningPlanRequest {
  planId: string;
  version?: number;
  notes?: string | null;
  lines: ImportBinningPlanLineInput[];
}

export interface ImportBinningPlanResultDto {
  plan: BinningPlanDto;
  createdLines: number;
  updatedLines: number;
}

/**
 * RF-41: Location ↔ RFID mapping (hierarchy-native) DTOs.
 * The physical tag is bound to a Bin via binRfid; scans resolve binRfid
 * first and fall back to tierRfid.
 */
export interface RegisterLocationRequest {
  rfid: string;
  binCode: string;
}

export interface RegisterLocationResultDto {
  registered: boolean;
  location: LocationMappingDto | null;
}

export interface UnregisterLocationRequest {
  rfid: string;
}

export interface UnregisterLocationResultDto {
  unregistered: boolean;
  rfid: string;
}

/** Page of hierarchy bins for GET /binning/locations */
export interface ListLocationsQueryDto {
  warehouse?: string;
  binCode?: string;
  rfid?: string;
  page?: number;
  pageSize?: number;
}

export interface ListLocationsResultDto {
  items: LocationMappingDto[];
  total: number;
  page: number;
  pageSize: number;
}
