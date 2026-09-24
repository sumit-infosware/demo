import { Prisma } from "../../prisma/generated/prisma/client.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { DEVICE_TYPES } from "../constants/device-types.js";
import { ROLES } from "../constants/roles.js";
import { AlertSeverity, AlertType } from "../enums/alert.enum.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { EventType } from "../enums/event.enum.js";
import {
  BinningPlanLineStatus,
  BinningPlanStatus,
  PacketTagStatus,
  PlacementConfirmationStatus,
  PlanDownloadStatus,
  SyncLogStatus,
  SyncResultStatus,
} from "../enums/status.enum.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors/errors.js";
import { deviceCaller } from "../helpers/device-caller.helper.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import type {
  RawBinningPlanLine,
  RawBinningPlanWithLines,
  RawPlacementConfirmation,
  RawPlanDownload,
  RawSyncLog,
} from "../repositories/binning.repository.js";
import { binningRepository } from "../repositories/binning.repository.js";
import type {
  BinningPlanDto,
  BinningPlanLineDto,
  DownloadPlanResponse,
  FindLocationResultDto,
  ImportBinningPlanRequest,
  ImportBinningPlanResultDto,
  ListLocationsQueryDto,
  ListLocationsResultDto,
  LocationMappingDto,
  PlaceAndVerifyRequest,
  PlaceAndVerifyResponse,
  PlaceAndVerifySlotInfoDto,
  PlacementConfirmationDto,
  PlanDownloadDto,
  RegisterLocationRequest,
  RegisterLocationResultDto,
  SyncItemResultDto,
  SyncLogDto,
  SyncRedockRequest,
  SyncRedockResponse,
  UnregisterLocationRequest,
  UnregisterLocationResultDto,
} from "../types/binning.types.js";
import {
  countBins,
  listBins,
  registerRfidOnBin,
  unregisterRfid,
} from "./storage-hierarchy.service.js";

import { alertsService } from "./alerts.service.js";

type RawBinMapping = Exclude<Awaited<ReturnType<typeof binningRepository.findBinByCode>>, null>;
type RawTierMapping = Exclude<Awaited<ReturnType<typeof binningRepository.findTierByRfid>>, null>;

/**
 * Resolves a scanned RFID against the hierarchy: bin tag first, tier tag as
 * fallback ("if both are present use the bin; if not, use the tier").
 */
type ResolvedScan =
  | { kind: "bin"; bin: RawBinMapping; scannedTag: string }
  | { kind: "tier"; tier: RawTierMapping; scannedTag: string };

async function resolveScan(rfid: string): Promise<ResolvedScan | null> {
  const bin = await binningRepository.findBinByRfid(rfid);
  if (bin) return { kind: "bin", bin, scannedTag: rfid };
  const tier = await binningRepository.findTierByRfid(rfid);
  if (tier) return { kind: "tier", tier, scannedTag: rfid };
  return null;
}

/**
 * The tag a device is expected to scan for a bin: a real registered binRfid
 * when present, otherwise the tier's tag. Code-derived placeholders mean the
 * branch was never physically registered, so the tier tag should be used.
 */
function effectiveScanTagFor(bin: RawBinMapping): string {
  const w = bin.tier.row.bay.warehouse.code;
  const b = bin.tier.row.bay.code;
  const r = bin.tier.row.code;
  const t = bin.tier.code;
  const binPlaceholder = `TIER-${w}-${b}-${r}-${t}-${bin.code}`;
  if (bin.binRfid !== binPlaceholder) return bin.binRfid;
  const tierPlaceholder = `TIER-${w}-${b}-${r}-${t}`;
  if (bin.tier.tierRfid !== tierPlaceholder) return bin.tier.tierRfid;
  return bin.binRfid;
}

function toLocationMappingDto(bin: RawBinMapping): LocationMappingDto {
  return {
    binId: String(bin.id),
    binCode: bin.code,
    binRfid: bin.binRfid,
    binName: bin.name,
    tierCode: bin.tier.code,
    tierRfid: bin.tier.tierRfid,
    tierName: bin.tier.name,
    rowCode: bin.tier.row.code,
    bayCode: bin.tier.row.bay.code,
    warehouseCode: bin.tier.row.bay.warehouse.code,
  };
}

function toTierMappingDto(tier: RawTierMapping): LocationMappingDto {
  return {
    binId: null,
    binCode: null,
    binRfid: null,
    binName: null,
    tierCode: tier.code,
    tierRfid: tier.tierRfid,
    tierName: tier.name,
    rowCode: tier.row.code,
    bayCode: tier.row.bay.code,
    warehouseCode: tier.row.bay.warehouse.code,
  };
}

function toSlotInfo(bin: RawBinMapping): PlaceAndVerifySlotInfoDto {
  return {
    binId: String(bin.id),
    binCode: bin.code,
    binRfid: bin.binRfid,
    tierCode: bin.tier.code,
    tierRfid: bin.tier.tierRfid,
    rowCode: bin.tier.row.code,
    bayCode: bin.tier.row.bay.code,
    warehouseCode: bin.tier.row.bay.warehouse.code,
  };
}

function toPlacementConfirmationDto(c: RawPlacementConfirmation): PlacementConfirmationDto {
  return {
    id: c.id.toString(),
    planLineId: c.planLineId.toString(),
    packetTagId: c.packetTagId.toString(),
    expectedLocationTagId: c.expectedLocationTagId,
    actualLocationTagId: c.actualLocationTagId,
    expectedBinId: c.expectedBinId,
    expectedPositionId: c.expectedPositionId,
    actualBinId: c.actualBinId,
    actualPositionId: c.actualPositionId,
    status: c.status,
    mismatchReason: c.mismatchReason,
    deviceId: c.deviceId.toString(),
    operatorId: c.operatorId,
    isOffline: c.isOffline,
    confirmedAt: c.confirmedAt,
    syncedAt: c.syncedAt,
    syncLogId: c.syncLogId?.toString() ?? null,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function toSyncLogDto(log: RawSyncLog): SyncLogDto {
  return {
    id: log.id.toString(),
    deviceId: log.deviceId.toString(),
    startedAt: log.startedAt,
    completedAt: log.completedAt,
    status: log.status,
    confirmationsUploaded: log.confirmationsUploaded,
    conflictsDetected: log.conflictsDetected,
    errorMessage: log.errorMessage,
    metadata: log.metadata as Record<string, unknown> | null,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

function toBinningPlanLineDto(line: RawBinningPlanLine): BinningPlanLineDto {
  return {
    id: line.id.toString(),
    lineNo: line.lineNo,
    rrLineId: line.rrLineId?.toString() ?? null,
    packetTagId: line.packetTagId?.toString() ?? null,
    itemCode: line.itemCode,
    expectedQty: Number(line.expectedQty.toString()),
    binId: line.binId,
    positionId: line.positionId,
    locationTagId: line.locationTagId ?? null,
    status: line.status,
    notes: line.notes,
  };
}

function toBinningPlanDto(plan: RawBinningPlanWithLines): BinningPlanDto {
  const lines = plan.lines?.map(toBinningPlanLineDto) ?? [];
  const totalLines = lines.length;
  const completedLines = lines.filter(
    (l) => (l.status as BinningPlanLineStatus) === BinningPlanLineStatus.COMPLETED,
  ).length;
  const pendingLines = lines.filter(
    (l) => (l.status as BinningPlanLineStatus) === BinningPlanLineStatus.PENDING,
  ).length;

  return {
    id: plan.id.toString(),
    planId: plan.planId,
    version: plan.version,
    status: plan.status,
    source: plan.source,
    fetchedAt: plan.fetchedAt,
    activatedAt: plan.activatedAt,
    lines,
    totalLines,
    completedLines,
    pendingLines,
  };
}

function toPlanDownloadDto(download: RawPlanDownload): PlanDownloadDto {
  return {
    id: download.id.toString(),
    planId: download.planId.toString(),
    deviceId: download.deviceId.toString(),
    downloadedAt: download.downloadedAt,
    downloadedBy: download.downloadedBy,
    status: download.status,
    syncedAt: download.syncedAt,
    expiresAt: download.expiresAt,
    errorMessage: download.errorMessage,
    createdAt: download.createdAt,
    updatedAt: download.updatedAt,
  };
}

export const binningService = {
  /**
   * Fetch a binning plan by its IFS plan ID
   * This is the primary endpoint for RF-37 - Fetch Bin/Position Plan
   */
  getPlanByPlanId: async (planId: string, auditCtx?: AuditContext): Promise<BinningPlanDto> => {
    const plan = await binningRepository.findPlanByPlanId(planId);
    if (!plan) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_READ,
        resource: AuditResource.BINNING_PLAN,
        resourceId: planId,
        result: AuditResult.FAILURE,
        meta: { reason: "not_found", planId },
      });
      throw new NotFoundError("Binning plan");
    }

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_PLAN_READ,
      resource: AuditResource.BINNING_PLAN,
      resourceId: plan.id.toString(),
      result: AuditResult.SUCCESS,
      meta: { planId: plan.planId },
    });

    return toBinningPlanDto(plan);
  },

  /**
   * Fetch the latest active binning plan
   * Useful when the client doesn't know the specific plan ID
   */
  getLatestActivePlan: async (auditCtx?: AuditContext): Promise<BinningPlanDto> => {
    const plan = await binningRepository.findLatestActivePlan();
    if (!plan) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_READ,
        resource: AuditResource.BINNING_PLAN,
        result: AuditResult.FAILURE,
        meta: { reason: "no_active_plan" },
      });
      throw new NotFoundError("Active binning plan");
    }

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_PLAN_READ,
      resource: AuditResource.BINNING_PLAN,
      resourceId: plan.id.toString(),
      result: AuditResult.SUCCESS,
      meta: { planId: plan.planId },
    });

    return toBinningPlanDto(plan);
  },

  /**
   * List binning plans with pagination
   */
  listPlans: async (
    filters: { status?: string; page?: number; limit?: number },
    auditCtx?: AuditContext,
  ) => {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.max(1, Math.min(100, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const [plans, total] = await Promise.all([
      binningRepository.listPlans({ status: filters.status, skip, take: limit }),
      binningRepository.countPlans({ status: filters.status }),
    ]);

    const items = plans.map((p) => ({
      id: p.id.toString(),
      planId: p.planId,
      version: p.version,
      status: p.status,
      source: p.source,
      fetchedAt: p.fetchedAt,
      activatedAt: p.activatedAt,
      totalLines: 0, // Not included in list view
    }));

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_PLAN_LIST,
      resource: AuditResource.BINNING_PLAN,
      result: AuditResult.SUCCESS,
      meta: { count: items.length, page, limit },
    });

    return {
      plans: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  // ===== RF-38: Plan Download methods =====

  /**
   * Download a binning plan to a handheld device
   * Creates a PlanDownload record and PlanSyncState for tracking
   */
  downloadPlanToDevice: async (
    planId: string,
    deviceId: string,
    downloadedBy: string | undefined,
    expiresInHours: number,
    auditCtx?: AuditContext,
  ): Promise<DownloadPlanResponse> => {
    // Find the plan
    const plan = await binningRepository.findPlanByPlanId(planId);
    if (!plan) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_DOWNLOAD,
        resource: AuditResource.BINNING_PLAN,
        resourceId: planId,
        result: AuditResult.FAILURE,
        meta: { reason: "plan_not_found", planId, deviceId },
      });
      throw new NotFoundError("Binning plan");
    }

    // Validate the plan is active
    if ((plan.status as BinningPlanStatus) !== BinningPlanStatus.ACTIVE) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_DOWNLOAD,
        resource: AuditResource.BINNING_PLAN,
        resourceId: plan.id.toString(),
        result: AuditResult.FAILURE,
        meta: { reason: "plan_not_active", planId: plan.planId, status: plan.status, deviceId },
      });
      throw new ConflictError(
        `Cannot download plan with status: ${plan.status}. Plan must be ACTIVE.`,
      );
    }

    // Find the device
    const device = await binningRepository.findDeviceByDeviceId(deviceId);
    if (!device) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_DOWNLOAD,
        resource: AuditResource.DEVICE_REGISTRY,
        resourceId: deviceId,
        result: AuditResult.FAILURE,
        meta: { reason: "device_not_found", deviceId, planId },
      });
      throw new NotFoundError("Device");
    }

    // Validate device is a handheld
    if (device.deviceType !== DEVICE_TYPES.HANDHELD) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_DOWNLOAD,
        resource: AuditResource.DEVICE_REGISTRY,
        resourceId: device.id.toString(),
        result: AuditResult.FAILURE,
        meta: { reason: "invalid_device_type", deviceId, deviceType: device.deviceType, planId },
      });
      throw new ConflictError(`Device must be a HANDHELD device, got: ${device.deviceType}`);
    }

    // Validate device is active
    if (!device.isActive) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_DOWNLOAD,
        resource: AuditResource.DEVICE_REGISTRY,
        resourceId: device.id.toString(),
        result: AuditResult.FAILURE,
        meta: { reason: "device_inactive", deviceId, planId },
      });
      throw new ConflictError("Device is not active");
    }

    // Check if already downloaded
    const existingDownload = await binningRepository.findPlanDownload(plan.id, device.id);
    if (existingDownload) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_DOWNLOAD,
        resource: AuditResource.PLAN_DOWNLOAD,
        resourceId: existingDownload.id.toString(),
        result: AuditResult.FAILURE,
        meta: { reason: "already_downloaded", planId: plan.planId, deviceId },
      });
      throw new ConflictError("Plan already downloaded to this device");
    }

    await deviceCaller.sendPlan(device, {
      planId: plan.planId,
      version: plan.version,
      source: plan.source,
      fetchedAt: plan.fetchedAt.toISOString(),
      lines: plan.lines.map((line) => ({
        lineNo: line.lineNo,
        packetTagId: line.packetTagId?.toString() ?? null,
        itemCode: line.itemCode,
        expectedQty: line.expectedQty.toString(),
        binId: line.binId,
        positionId: line.positionId,
        locationTagId: line.locationTagId,
        status: line.status,
      })),
    });

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Create the download record
    const download = await binningRepository.createPlanDownload({
      planId: plan.id,
      deviceId: device.id,
      downloadedBy: downloadedBy ?? null,
      expiresAt,
    });

    // Create/update sync state
    await binningRepository.upsertPlanSyncState(plan.id, device.id);

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_PLAN_DOWNLOAD,
      resource: AuditResource.PLAN_DOWNLOAD,
      resourceId: download.id.toString(),
      result: AuditResult.SUCCESS,
      meta: { planId: plan.planId, deviceId, expiresAt: expiresAt.toISOString() },
    });

    return {
      download: toPlanDownloadDto(download),
      plan: toBinningPlanDto(plan),
    };
  },

  // ===== RF-39: Find Location methods =====

  /**
   * Find a location based on flexible query criteria:
   * 1. By RFID tagId (bin tag first, tier tag fallback)
   * 2. By binId (bin code)
   * 3. By planId + lineNo
   */
  findLocation: async (
    query: {
      binId?: string;
      tagId?: string;
      planId?: string;
      lineNo?: number;
    },
    auditCtx?: AuditContext,
  ): Promise<FindLocationResultDto> => {
    // Case 1: Search by plan line
    if (query.planId && query.lineNo !== undefined) {
      const line = await binningRepository.findPlanLineByPlanIdAndLineNo(
        query.planId,
        query.lineNo,
      );
      if (!line) {
        await writeAudit(auditCtx, {
          action: AuditAction.BINNING_LOCATION_FIND,
          resource: AuditResource.BINNING_PLAN_LINE,
          result: AuditResult.FAILURE,
          meta: { reason: "plan_line_not_found", planId: query.planId, lineNo: query.lineNo },
        });
        throw new NotFoundError(`Binning plan line (Plan: ${query.planId}, Line: ${query.lineNo})`);
      }

      const bin = await binningRepository.findBinByCode(line.binId);
      if (!bin) {
        await writeAudit(auditCtx, {
          action: AuditAction.BINNING_LOCATION_FIND,
          resource: AuditResource.BIN,
          result: AuditResult.FAILURE,
          meta: {
            reason: "bin_not_found",
            planId: query.planId,
            lineNo: query.lineNo,
            binCode: line.binId,
          },
        });
        throw new NotFoundError(`Bin ${line.binId}`);
      }

      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_LOCATION_FIND,
        resource: AuditResource.BIN,
        resourceId: String(bin.id),
        result: AuditResult.SUCCESS,
        meta: {
          planId: query.planId,
          lineNo: query.lineNo,
          binCode: bin.code,
          tagId: effectiveScanTagFor(bin),
        },
      });

      return {
        location: toLocationMappingDto(bin),
        planLine: {
          id: line.id.toString(),
          planId: line.plan.planId,
          lineNo: line.lineNo,
          itemCode: line.itemCode,
          expectedQty: Number(line.expectedQty.toString()),
          binId: line.binId,
          positionId: line.positionId,
          locationTagId: line.locationTagId,
          status: line.status,
          notes: line.notes,
        },
      };
    }

    // Case 2: Search by RFID tag (bin first, tier fallback)
    if (query.tagId) {
      const resolved = await resolveScan(query.tagId);
      if (!resolved) {
        await writeAudit(auditCtx, {
          action: AuditAction.BINNING_LOCATION_FIND,
          resource: AuditResource.BIN,
          result: AuditResult.FAILURE,
          meta: { reason: "tag_not_found", tagId: query.tagId },
        });
        throw new NotFoundError(`Location for tag ${query.tagId}`);
      }

      const location =
        resolved.kind === "bin"
          ? toLocationMappingDto(resolved.bin)
          : toTierMappingDto(resolved.tier);

      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_LOCATION_FIND,
        resource: AuditResource.BIN,
        result: AuditResult.SUCCESS,
        meta: { tagId: query.tagId, binCode: location.binCode, tierCode: location.tierCode },
      });

      return {
        location,
        planLine: null,
      };
    }

    // Case 3: Search by Bin code
    if (query.binId) {
      const bin = await binningRepository.findBinByCode(query.binId);
      if (!bin) {
        await writeAudit(auditCtx, {
          action: AuditAction.BINNING_LOCATION_FIND,
          resource: AuditResource.BIN,
          result: AuditResult.FAILURE,
          meta: { reason: "bin_not_found", binCode: query.binId },
        });
        throw new NotFoundError(`Bin ${query.binId}`);
      }

      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_LOCATION_FIND,
        resource: AuditResource.BIN,
        resourceId: String(bin.id),
        result: AuditResult.SUCCESS,
        meta: { binCode: bin.code, tagId: effectiveScanTagFor(bin) },
      });

      return {
        location: toLocationMappingDto(bin),
        planLine: null,
      };
    }

    throw new NotFoundError("Location");
  },

  /**
   * Get a location directly by its scanned RFID tag (bin tag first, tier tag
   * fallback).
   */
  getLocationByTagId: async (
    tagId: string,
    auditCtx?: AuditContext,
  ): Promise<LocationMappingDto> => {
    const resolved = await resolveScan(tagId);
    if (!resolved) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_LOCATION_READ,
        resource: AuditResource.BIN,
        result: AuditResult.FAILURE,
        meta: { reason: "not_found", tagId },
      });
      throw new NotFoundError(`Location with tag ${tagId}`);
    }

    const location =
      resolved.kind === "bin"
        ? toLocationMappingDto(resolved.bin)
        : toTierMappingDto(resolved.tier);

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_LOCATION_READ,
      resource: AuditResource.BIN,
      result: AuditResult.SUCCESS,
      meta: { tagId, binCode: location.binCode, tierCode: location.tierCode },
    });

    return location;
  },

  /**
   * Get a location and slot guidance for a specific plan line
   */
  getLocationForPlanLine: async (
    planId: string,
    lineNo: number,
    auditCtx?: AuditContext,
  ): Promise<FindLocationResultDto> => {
    const line = await binningRepository.findPlanLineByPlanIdAndLineNo(planId, lineNo);
    if (!line) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_LINE_LOCATION_READ,
        resource: AuditResource.BINNING_PLAN_LINE,
        result: AuditResult.FAILURE,
        meta: { reason: "line_not_found", planId, lineNo },
      });
      throw new NotFoundError(`Binning plan line (Plan: ${planId}, Line: ${lineNo})`);
    }

    const bin = await binningRepository.findBinByCode(line.binId);
    if (!bin) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_LINE_LOCATION_READ,
        resource: AuditResource.BIN,
        result: AuditResult.FAILURE,
        meta: { reason: "bin_not_found", planId, lineNo, binCode: line.binId },
      });
      throw new NotFoundError(`Bin ${line.binId}`);
    }

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_PLAN_LINE_LOCATION_READ,
      resource: AuditResource.BIN,
      resourceId: String(bin.id),
      result: AuditResult.SUCCESS,
      meta: { planId, lineNo, binCode: bin.code, tagId: effectiveScanTagFor(bin) },
    });

    return {
      location: toLocationMappingDto(bin),
      planLine: {
        id: line.id.toString(),
        planId: line.plan.planId,
        lineNo: line.lineNo,
        itemCode: line.itemCode,
        expectedQty: Number(line.expectedQty.toString()),
        binId: line.binId,
        positionId: line.positionId,
        locationTagId: line.locationTagId,
        status: line.status,
        notes: line.notes,
      },
    };
  },

  // ===== RF-40: Place & Verify methods =====

  /**
   * Verify placement of a packet in a bin/position and confirm if matching.
   * On match: Creates PlacementConfirmation, marks plan line as COMPLETED, updates tag to STORED, logs event.
   * On mismatch: Warns operator with expected vs actual, raises alert, logs mismatch event, does NOT confirm.
   */
  placeAndVerify: async (
    data: PlaceAndVerifyRequest,
    operatorId: string,
    auditCtx?: AuditContext,
  ): Promise<PlaceAndVerifyResponse> => {
    // 1. Validate handheld device
    const device = await binningRepository.findDeviceByDeviceId(data.deviceId);
    if (!device) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLACEMENT_VERIFY,
        resource: AuditResource.DEVICE_REGISTRY,
        resourceId: data.deviceId,
        result: AuditResult.FAILURE,
        meta: { reason: "device_not_found", deviceId: data.deviceId },
      });
      throw new NotFoundError("Device");
    }

    if (device.deviceType !== DEVICE_TYPES.HANDHELD) {
      throw new ConflictError(`Device must be a HANDHELD device, got: ${device.deviceType}`);
    }

    if (!device.isActive) {
      throw new ConflictError("Device is not active");
    }

    // 2. Validate packet tag
    let packet = null;
    if (data.packetEpc) {
      packet = await binningRepository.findPacketByEpc(data.packetEpc);
    } else if (data.packetTagId) {
      packet = await binningRepository.findPacketById(BigInt(data.packetTagId));
    }

    if (!packet) {
      const identifier = data.packetEpc ?? data.packetTagId;
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLACEMENT_VERIFY,
        resource: AuditResource.PACKET_TAG,
        resourceId: identifier,
        result: AuditResult.FAILURE,
        meta: { reason: "packet_not_found", identifier },
      });
      throw new NotFoundError(`Packet tag (${identifier})`);
    }

    // 3. Find active binning plan line for this packet
    const planLine = await binningRepository.findActivePlanLineForPacket({
      packetTagId: packet.id,
      itemCode: packet.itemCode,
      planId: data.planId,
    });

    if (!planLine) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLACEMENT_VERIFY,
        resource: AuditResource.BINNING_PLAN_LINE,
        result: AuditResult.FAILURE,
        meta: {
          reason: "no_active_plan_line",
          packetId: packet.id.toString(),
          itemCode: packet.itemCode,
          planId: data.planId,
        },
      });
      throw new NotFoundError(
        `Active binning plan assignment for packet ${packet.epc} (item: ${packet.itemCode})`,
      );
    }

    // 4. Resolve expected physical location (planLine.binId is the bin code)
    const expectedBinCode = planLine.binId;
    const expectedBin = await binningRepository.findBinByCode(expectedBinCode);

    if (!expectedBin) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLACEMENT_VERIFY,
        resource: AuditResource.BIN,
        result: AuditResult.FAILURE,
        meta: {
          reason: "expected_bin_unmapped",
          binCode: expectedBinCode,
        },
      });
      throw new NotFoundError(`Bin ${expectedBinCode}`);
    }

    const expectedScanTag = effectiveScanTagFor(expectedBin);

    // 5. Resolve actual scanned location (bin tag first, tier tag fallback)
    let actualBin: RawBinMapping | null = null;
    let actualLocationTagId: string | null = null;

    if (data.locationTagId) {
      actualLocationTagId = data.locationTagId;
      const resolved = await resolveScan(data.locationTagId);
      if (resolved && resolved.kind === "bin") {
        actualBin = resolved.bin;
      }
    } else if (data.binId) {
      actualBin = await binningRepository.findBinByCode(data.binId);
      actualLocationTagId = actualBin ? effectiveScanTagFor(actualBin) : null;
    }

    // 6. Compare expected bin vs actual scanned bin
    const isMatch = Boolean(
      actualBin && actualBin.code.trim().toUpperCase() === expectedBin.code.trim().toUpperCase(),
    );

    const expectedLocationInfo = toSlotInfo(expectedBin);
    const actualLocationInfo = actualBin
      ? toSlotInfo(actualBin)
      : {
          binId: null,
          binCode: null,
          binRfid: null,
          tierCode: null,
          tierRfid: null,
          rowCode: null,
          bayCode: null,
          warehouseCode: null,
        };

    // 7. Branch: Correct Location (Match)
    if (isMatch) {
      // Idempotency check: see if already confirmed
      const existing = await binningRepository.findExistingPlacementConfirmation(
        planLine.id,
        packet.id,
      );

      if (existing) {
        await writeAudit(auditCtx, {
          action: AuditAction.BINNING_PLACEMENT_CONFIRM,
          resource: AuditResource.PLACEMENT_CONFIRMATION,
          resourceId: existing.id.toString(),
          result: AuditResult.SUCCESS,
          meta: {
            reason: "already_confirmed",
            epc: packet.epc,
            planId: planLine.plan.planId,
            lineNo: planLine.lineNo,
          },
        });

        return {
          verified: true,
          status: PlacementConfirmationStatus.CONFIRMED,
          message: "Placement already confirmed",
          expectedLocation: expectedLocationInfo,
          actualLocation: actualLocationInfo,
          confirmation: toPlacementConfirmationDto(existing),
        };
      }

      // Create new confirmation record
      const confirmation = await binningRepository.confirmPlacement({
        planLineId: planLine.id,
        packetTagId: packet.id,
        expectedLocationTagId: expectedScanTag,
        actualLocationTagId: actualLocationTagId ?? expectedScanTag,
        expectedBinId: expectedBin.code,
        expectedPositionId: null,
        actualBinId: actualBin?.code ?? null,
        actualPositionId: null,
        deviceId: device.id,
        operatorId,
        isOffline: data.isOffline ?? false,
        confirmedAt: data.confirmedAt ?? new Date(),
        notes: data.notes ?? null,
      });

      // Log event
      await eventLogger.log({
        ref: packet.epc,
        eventType: EventType.PUT_AWAY_SYNCED,
        phase: "BINNING",
        device: device.deviceId,
        appUser: operatorId,
        payload: {
          planId: planLine.plan.planId,
          lineNo: planLine.lineNo,
          binCode: expectedBin.code,
          locationTagId: expectedScanTag,
          isOffline: data.isOffline ?? false,
        },
      });

      // Audit log
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLACEMENT_CONFIRM,
        resource: AuditResource.PLACEMENT_CONFIRMATION,
        resourceId: confirmation.id.toString(),
        result: AuditResult.SUCCESS,
        meta: {
          epc: packet.epc,
          planId: planLine.plan.planId,
          lineNo: planLine.lineNo,
          binCode: expectedBin.code,
          isOffline: data.isOffline ?? false,
        },
      });

      return {
        verified: true,
        status: PlacementConfirmationStatus.CONFIRMED,
        message: "Placement verified and confirmed successfully",
        expectedLocation: expectedLocationInfo,
        actualLocation: actualLocationInfo,
        confirmation: toPlacementConfirmationDto(confirmation),
      };
    }

    // 8. Branch: Wrong Location (Mismatch)
    const mismatchReason = `Expected Bin ${expectedBin.code} (Tag: ${expectedScanTag}); Actual Bin ${actualBin?.code ?? "UNKNOWN"} (Tag: ${actualLocationTagId ?? "UNKNOWN"})`;

    // Raise Alert for wrong bin placement attempt
    await alertsService.raise({
      type: AlertType.WRONG_BIN_PLACEMENT,
      severity: AlertSeverity.WARNING,
      recipientRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATOR],
      ref: packet.epc,
      message: `Wrong bin placement attempt for packet EPC ${packet.epc}. Expected ${expectedBin.code}, got ${actualBin?.code ?? actualLocationTagId ?? "UNKNOWN"}`,
      sourceFn: "binning.placeAndVerify",
      meta: {
        epc: packet.epc,
        expected: {
          binCode: expectedBin.code,
          tagId: expectedScanTag,
        },
        actual: { binCode: actualBin?.code ?? null, tagId: actualLocationTagId },
        deviceId: device.deviceId,
        operatorId,
      },
    });

    // Log PLACEMENT_MISMATCH event
    await eventLogger.log({
      ref: packet.epc,
      eventType: EventType.PLACEMENT_MISMATCH,
      phase: "BINNING",
      device: device.deviceId,
      appUser: operatorId,
      payload: {
        expected: {
          binCode: expectedBin.code,
          tagId: expectedScanTag,
        },
        actual: { binCode: actualBin?.code ?? null, tagId: actualLocationTagId },
        mismatchReason,
      },
    });

    // Audit log
    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_PLACEMENT_VERIFY,
      resource: AuditResource.PLACEMENT_CONFIRMATION,
      result: AuditResult.FAILURE,
      meta: {
        reason: "wrong_location",
        epc: packet.epc,
        expected: { binCode: expectedBin.code, tagId: expectedScanTag },
        actual: { binCode: actualBin?.code ?? null, tagId: actualLocationTagId },
      },
    });

    return {
      verified: false,
      status: PlacementConfirmationStatus.MISMATCH,
      message: "Wrong location: packet not placed in the assigned bin",
      mismatchReason,
      expectedLocation: expectedLocationInfo,
      actualLocation: actualLocationInfo,
      confirmation: null,
    };
  },

  // ===== RF-37 (manual import): Plan import/activate methods =====

  /**
   * Idempotent import of a binning plan as final data (no IFS read). Validates
   * every referenced bin code against the storage hierarchy, upserts the plan
   * as DRAFT + its lines, and returns the persisted plan.
   */
  importPlan: async (
    data: ImportBinningPlanRequest,
    userId: string | undefined,
    auditCtx?: AuditContext,
  ): Promise<ImportBinningPlanResultDto> => {
    const uniqueBinCodes = [...new Set(data.lines.map((l) => l.binCode))];
    const missingBinCodes: string[] = [];
    for (const binCode of uniqueBinCodes) {
      const bin = await binningRepository.findBinByCode(binCode);
      if (!bin) missingBinCodes.push(binCode);
    }
    if (missingBinCodes.length > 0) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_IMPORT,
        resource: AuditResource.BINNING_PLAN,
        resourceId: data.planId,
        result: AuditResult.FAILURE,
        meta: { reason: "unknown_bin_codes", binCodes: missingBinCodes },
      });
      throw new ValidationError(
        `Unknown bin code(s): ${missingBinCodes.join(", ")} — create them via POST /binning/locations/register first`,
      );
    }

    const result = await binningRepository.importBinningPlan({
      planId: data.planId,
      version: data.version,
      notes: data.notes,
      fetchedBy: userId ?? null,
      lines: data.lines.map((line, index) => ({
        lineNo: line.lineNo ?? index + 1,
        itemCode: line.itemCode,
        expectedQty: new Prisma.Decimal(line.expectedQty),
        binCode: line.binCode,
        notes: line.notes,
      })),
    });

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_PLAN_IMPORT,
      resource: AuditResource.BINNING_PLAN,
      resourceId: result.plan.id.toString(),
      result: AuditResult.SUCCESS,
      meta: {
        planId: data.planId,
        version: result.plan.version,
        createdLines: result.createdLines,
        updatedLines: result.updatedLines,
      },
    });

    return {
      plan: toBinningPlanDto(result.plan),
      createdLines: result.createdLines,
      updatedLines: result.updatedLines,
    };
  },

  /**
   * Promote a DRAFT binning plan to ACTIVE so it can be downloaded to
   * handhelds.
   */
  activatePlan: async (planId: string, auditCtx?: AuditContext): Promise<BinningPlanDto> => {
    const activated = await binningRepository.activateBinningPlan(planId);

    if (!activated) {
      const existing = await binningRepository.findPlanByPlanId(planId);
      if (!existing) {
        await writeAudit(auditCtx, {
          action: AuditAction.BINNING_PLAN_ACTIVATE,
          resource: AuditResource.BINNING_PLAN,
          resourceId: planId,
          result: AuditResult.FAILURE,
          meta: { reason: "plan_not_found", planId },
        });
        throw new NotFoundError("Binning plan");
      }
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_PLAN_ACTIVATE,
        resource: AuditResource.BINNING_PLAN,
        resourceId: existing.id.toString(),
        result: AuditResult.FAILURE,
        meta: { reason: "not_draft", planId, status: existing.status },
      });
      throw new ConflictError(
        `Cannot activate plan ${planId}: current status is ${existing.status}`,
      );
    }

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_PLAN_ACTIVATE,
      resource: AuditResource.BINNING_PLAN,
      resourceId: activated.id.toString(),
      result: AuditResult.SUCCESS,
      meta: { planId, version: activated.version },
    });

    return toBinningPlanDto(activated);
  },

  // ===== RF-41: Location ↔ RFID Mapping Admin methods =====

  /**
   * List bins across the storage hierarchy with optional filters
   * (warehouse, binCode substring, rfid substring) and pagination.
   */
  listLocations: async (
    query: ListLocationsQueryDto,
    auditCtx?: AuditContext,
  ): Promise<ListLocationsResultDto> => {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const [bins, total] = await Promise.all([
      listBins({
        warehouse: query.warehouse,
        binCode: query.binCode,
        rfid: query.rfid,
        skip,
        take: pageSize,
      }),
      countBins({
        warehouse: query.warehouse,
        binCode: query.binCode,
        rfid: query.rfid,
      }),
    ]);

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_LOCATION_LIST,
      resource: AuditResource.BIN,
      result: AuditResult.SUCCESS,
      meta: { count: bins.length, total, page, pageSize },
    });

    return {
      items: bins.map(toLocationMappingDto),
      total,
      page,
      pageSize,
    };
  },

  /**
   * Bind a physical RFID tag to a hierarchical bin (sets binRfid).
   */
  registerLocation: async (
    data: RegisterLocationRequest,
    operatorId: string,
    auditCtx?: AuditContext,
  ): Promise<RegisterLocationResultDto> => {
    const bin = await binningRepository.findBinByCode(data.binCode);
    if (!bin) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_LOCATION_REGISTER,
        resource: AuditResource.BIN,
        result: AuditResult.FAILURE,
        meta: { reason: "bin_not_found", binCode: data.binCode },
      });
      throw new NotFoundError(`Bin ${data.binCode}`);
    }

    const existingBin = await binningRepository.findBinByRfid(data.rfid);
    if (existingBin) {
      throw new ConflictError(`RFID ${data.rfid} is already bound to bin ${existingBin.code}`);
    }
    const existingTier = await binningRepository.findTierByRfid(data.rfid);
    if (existingTier) {
      throw new ConflictError(`RFID ${data.rfid} is already bound to tier ${existingTier.code}`);
    }

    let registered: boolean;
    try {
      registered = await registerRfidOnBin(data.rfid, data.binCode);
    } catch {
      throw new ConflictError(
        `RFID ${data.rfid} cannot be bound to bin ${data.binCode} (already in use)`,
      );
    }

    const updated = await binningRepository.findBinByCode(data.binCode);

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_LOCATION_REGISTER,
      resource: AuditResource.BIN,
      resourceId: bin.id.toString(),
      result: registered ? AuditResult.SUCCESS : AuditResult.FAILURE,
      meta: { rfid: data.rfid, binCode: data.binCode, operatorId },
    });

    return {
      registered,
      location: updated ? toLocationMappingDto(updated) : null,
    };
  },

  /**
   * Release a physical RFID tag from the hierarchy (resets the matching
   * bin/tier to its code-derived placeholder).
   */
  unregisterLocation: async (
    data: UnregisterLocationRequest,
    operatorId: string,
    auditCtx?: AuditContext,
  ): Promise<UnregisterLocationResultDto> => {
    const existingBin = await binningRepository.findBinByRfid(data.rfid);
    const existingTier = await binningRepository.findTierByRfid(data.rfid);
    if (!existingBin && !existingTier) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_LOCATION_UNREGISTER,
        resource: AuditResource.BIN,
        result: AuditResult.FAILURE,
        meta: { reason: "tag_not_bound", rfid: data.rfid },
      });
      throw new NotFoundError(`Bound location for tag ${data.rfid}`);
    }

    await unregisterRfid(data.rfid);

    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_LOCATION_UNREGISTER,
      resource: AuditResource.BIN,
      result: AuditResult.SUCCESS,
      meta: { rfid: data.rfid, operatorId },
    });

    return { unregistered: true, rfid: data.rfid };
  },

  // ===== RF-42: Sync on Re-dock methods =====

  /**
   * Bulk upload and synchronize offline placement confirmations on handheld re-dock
   */
  syncRedock: async (
    data: SyncRedockRequest,
    operatorId: string,
    auditCtx?: AuditContext,
  ): Promise<SyncRedockResponse> => {
    // 1. Validate handheld device registry
    const device = await binningRepository.findDeviceByDeviceId(data.deviceId);
    if (!device) {
      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_SYNC_REDOCK,
        resource: AuditResource.DEVICE_REGISTRY,
        resourceId: data.deviceId,
        result: AuditResult.FAILURE,
        meta: { reason: "device_not_found", deviceId: data.deviceId },
      });
      throw new NotFoundError("DeviceRegistry");
    }

    if (device.deviceType !== DEVICE_TYPES.HANDHELD) {
      throw new ConflictError(`Device must be a HANDHELD device, got: ${device.deviceType}`);
    }

    if (!device.isActive) {
      throw new ConflictError("Device is not active");
    }

    // 2. Create the synchronization session log entry
    const syncLog = await binningRepository.createSyncLog({
      deviceId: device.id,
      status: SyncLogStatus.IN_PROGRESS,
    });

    // 3. Resolve the targeted binning plan
    let plan = null;
    if (data.planId) {
      plan = await binningRepository.findPlanByPlanId(data.planId);
    } else {
      const downloads = await binningRepository.listPlanDownloads({
        deviceId: device.id,
        take: 1,
      });
      const latestDownload = downloads[0];
      if (latestDownload && latestDownload.planId) {
        plan = await binningRepository.findPlanById(latestDownload.planId);
      }
    }

    if (!plan) {
      plan = await binningRepository.findLatestActivePlan();
    }

    if (!plan) {
      const errMsg = "No active or downloaded plan found for device to sync";
      await binningRepository.updateSyncLog(syncLog.id, {
        status: SyncLogStatus.FAILED,
        errorMessage: errMsg,
        completedAt: new Date(),
      });

      await writeAudit(auditCtx, {
        action: AuditAction.BINNING_SYNC_REDOCK,
        resource: AuditResource.SYNC_LOG,
        resourceId: syncLog.id.toString(),
        result: AuditResult.FAILURE,
        meta: { reason: "no_plan_found", deviceId: device.deviceId },
      });

      throw new NotFoundError("Active or downloaded binning plan");
    }

    if (data.planVersion !== undefined && data.planVersion !== plan.version) {
      const errMsg = `Plan version mismatch: handheld has ${data.planVersion}, server has ${plan.version}`;
      await binningRepository.updateSyncLog(syncLog.id, {
        status: SyncLogStatus.CONFLICT,
        errorMessage: errMsg,
        completedAt: new Date(),
        conflictsDetected: data.confirmations.length,
      });
      throw new ConflictError(errMsg);
    }

    let confirmationsUploaded = 0;
    let conflictsDetected = 0;
    let alreadySyncedCount = 0;
    let failedCount = 0;
    const results: SyncItemResultDto[] = [];

    // 4. Iterate and validate each confirmation in the batch
    for (const item of data.confirmations) {
      try {
        // Resolve packet tag
        let packet = null;
        if (item.packetEpc) {
          packet = await binningRepository.findPacketByEpc(item.packetEpc);
        } else if (item.packetTagId) {
          packet = await binningRepository.findPacketById(BigInt(item.packetTagId));
        }

        if (!packet) {
          failedCount++;
          results.push({
            packetEpc: item.packetEpc,
            packetTagId: item.packetTagId,
            status: SyncResultStatus.FAILED,
            message: `Packet tag not found (${item.packetEpc ?? item.packetTagId})`,
          });
          continue;
        }

        // Find active plan line for the packet
        const planLine = await binningRepository.findActivePlanLineForPacket({
          packetTagId: packet.id,
          itemCode: packet.itemCode,
          planId: plan.planId,
        });

        if (!planLine) {
          failedCount++;
          results.push({
            packetEpc: packet.epc,
            packetTagId: packet.id.toString(),
            status: SyncResultStatus.FAILED,
            message: `No active plan line assignment found for packet ${packet.epc} (item: ${packet.itemCode})`,
          });
          continue;
        }

        // Resolve expected bin (planLine.binId is the bin code)
        const expectedBinCode = planLine.binId;
        const expectedBin = await binningRepository.findBinByCode(expectedBinCode);

        if (!expectedBin) {
          failedCount++;
          results.push({
            packetEpc: packet.epc,
            packetTagId: packet.id.toString(),
            status: SyncResultStatus.FAILED,
            message: `Expected bin not found for bin code ${expectedBinCode}`,
          });
          continue;
        }

        const expectedScanTag = effectiveScanTagFor(expectedBin);

        // Resolve actual scanned location (bin tag first, tier tag fallback)
        let actualBin: RawBinMapping | null = null;
        let actualLocationTagId: string | null = null;

        if (item.locationTagId) {
          actualLocationTagId = item.locationTagId;
          const resolved = await resolveScan(item.locationTagId);
          if (resolved && resolved.kind === "bin") {
            actualBin = resolved.bin;
          }
        } else if (item.binId) {
          actualBin = await binningRepository.findBinByCode(item.binId);
          actualLocationTagId = actualBin ? effectiveScanTagFor(actualBin) : null;
        }

        // Compare expected vs actual placement
        const isMatch = Boolean(
          actualBin &&
          actualBin.code.trim().toUpperCase() === expectedBin.code.trim().toUpperCase(),
        );

        const expectedInfo = toSlotInfo(expectedBin);
        const actualInfo: PlaceAndVerifySlotInfoDto = actualBin
          ? toSlotInfo(actualBin)
          : {
              binId: null,
              binCode: null,
              binRfid: null,
              tierCode: null,
              tierRfid: null,
              rowCode: null,
              bayCode: null,
              warehouseCode: null,
            };

        const existingAny = await binningRepository.findAnyPlacementConfirmation(
          planLine.id,
          packet.id,
        );
        if (existingAny) {
          const sameLocation =
            existingAny.actualBinId === (actualBin?.code ?? expectedBin.code) &&
            existingAny.actualPositionId === null;
          if (
            sameLocation &&
            (existingAny.status as PlacementConfirmationStatus) ===
              PlacementConfirmationStatus.CONFIRMED &&
            isMatch
          ) {
            alreadySyncedCount++;
            results.push({
              packetEpc: packet.epc,
              packetTagId: packet.id.toString(),
              status: SyncResultStatus.ALREADY_SYNCED,
              message: "Placement confirmation is already synchronized",
              confirmationId: existingAny.id.toString(),
              expectedLocation: expectedInfo,
              actualLocation: actualInfo,
            });
            continue;
          }
          if (
            sameLocation &&
            (existingAny.status as PlacementConfirmationStatus) ===
              PlacementConfirmationStatus.MISMATCH &&
            !isMatch
          ) {
            alreadySyncedCount++;
            results.push({
              packetEpc: packet.epc,
              packetTagId: packet.id.toString(),
              status: SyncResultStatus.ALREADY_SYNCED,
              message: "Placement mismatch is already synchronized",
              confirmationId: existingAny.id.toString(),
              expectedLocation: expectedInfo,
              actualLocation: actualInfo,
              mismatchReason: existingAny.mismatchReason,
            });
            continue;
          }
          if (
            (existingAny.status as PlacementConfirmationStatus) ===
              PlacementConfirmationStatus.CONFIRMED &&
            !sameLocation
          ) {
            conflictsDetected++;
            results.push({
              packetEpc: packet.epc,
              packetTagId: packet.id.toString(),
              status: SyncResultStatus.CONFLICT,
              message: "Conflict: packet is already confirmed placed in a different slot",
              expectedLocation: expectedInfo,
              actualLocation: actualInfo,
              mismatchReason: `Conflicting prior confirmation ID ${existingAny.id.toString()} specifies bin ${existingAny.actualBinId ?? "UNKNOWN"}`,
            });
            continue;
          }
        }

        if (!isMatch) {
          // Location Mismatch Conflict: Packet was confirmed placed in the wrong bin offline
          conflictsDetected++;

          const mismatchReason = `Expected Bin ${expectedBin.code} (Tag: ${expectedScanTag}); Actual Bin ${actualBin?.code ?? "UNKNOWN"} (Tag: ${actualLocationTagId ?? "UNKNOWN"})`;

          // Raise Warning Alert for wrong placement
          await alertsService.raise({
            type: AlertType.WRONG_BIN_PLACEMENT,
            severity: AlertSeverity.WARNING,
            recipientRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.OPERATOR],
            ref: packet.epc,
            message: `Wrong offline bin placement synced for packet EPC ${packet.epc}. Expected ${expectedBin.code}, got ${actualBin?.code ?? actualLocationTagId ?? "UNKNOWN"}`,
            sourceFn: "binning.syncRedock",
            meta: {
              epc: packet.epc,
              expected: { binCode: expectedBin.code, tagId: expectedScanTag },
              actual: { binCode: actualBin?.code ?? null, tagId: actualLocationTagId },
              deviceId: device.deviceId,
              syncLogId: syncLog.id.toString(),
            },
          });

          // Log mismatch event
          await eventLogger.log({
            ref: packet.epc,
            eventType: EventType.PLACEMENT_MISMATCH,
            phase: "BINNING",
            device: device.deviceId,
            appUser: operatorId,
            payload: {
              expected: expectedInfo,
              actual: actualInfo,
              mismatchReason,
              isOffline: true,
              syncLogId: syncLog.id.toString(),
            },
          });

          // Store confirmation record marked as MISMATCH
          const confirmation = await binningRepository.createPlacementConfirmation({
            planLineId: planLine.id,
            packetTagId: packet.id,
            expectedLocationTagId: expectedScanTag,
            actualLocationTagId: actualLocationTagId ?? expectedScanTag,
            expectedBinId: expectedBin.code,
            expectedPositionId: null,
            actualBinId: actualBin?.code ?? null,
            actualPositionId: null,
            status: PlacementConfirmationStatus.MISMATCH,
            mismatchReason,
            deviceId: device.id,
            operatorId,
            isOffline: true,
            confirmedAt: item.confirmedAt ?? new Date(),
            notes: item.notes ?? null,
          });

          // Link to SyncLog
          await binningRepository.updatePlacementConfirmationSyncLog(confirmation.id, syncLog.id);

          results.push({
            packetEpc: packet.epc,
            packetTagId: packet.id.toString(),
            status: SyncResultStatus.CONFLICT,
            message: "Location mismatch: packet placed in wrong bin/position",
            confirmationId: confirmation.id.toString(),
            expectedLocation: expectedInfo,
            actualLocation: actualInfo,
            mismatchReason,
          });
          continue;
        }

        // Check if there is an existing confirmation (Deduplication / Idempotency check)
        const existing = await binningRepository.findExistingPlacementConfirmation(
          planLine.id,
          packet.id,
        );

        if (existing) {
          if (
            existing.actualBinId === (actualBin?.code ?? expectedBin.code) &&
            existing.actualPositionId === null
          ) {
            // Idempotent retry: exact same confirmation already uploaded
            alreadySyncedCount++;
            results.push({
              packetEpc: packet.epc,
              packetTagId: packet.id.toString(),
              status: SyncResultStatus.ALREADY_SYNCED,
              message: "Placement confirmation is already synchronized",
              confirmationId: existing.id.toString(),
              expectedLocation: expectedInfo,
              actualLocation: actualInfo,
            });
            continue;
          } else {
            // Prior sync confirmed it in a different slot (State conflict)
            conflictsDetected++;
            results.push({
              packetEpc: packet.epc,
              packetTagId: packet.id.toString(),
              status: SyncResultStatus.CONFLICT,
              message: "Conflict: packet is already confirmed placed in a different slot",
              expectedLocation: expectedInfo,
              actualLocation: actualInfo,
              mismatchReason: `Conflicting prior confirmation ID ${existing.id.toString()} specifies bin ${existing.actualBinId ?? "UNKNOWN"}`,
            });

            await eventLogger.log({
              ref: packet.epc,
              eventType: EventType.SYNC_CONFLICT,
              phase: "BINNING",
              device: device.deviceId,
              appUser: operatorId,
              payload: {
                packetEpc: packet.epc,
                existingConfirmation: toPlacementConfirmationDto(existing),
                newScannedLocation: actualInfo,
                reason: "Conflicting prior confirmation exists",
              },
            });
            continue;
          }
        }

        // No conflicts: persist placement confirmation
        const confirmation = await binningRepository.createPlacementConfirmation({
          planLineId: planLine.id,
          packetTagId: packet.id,
          expectedLocationTagId: expectedScanTag,
          actualLocationTagId: actualLocationTagId ?? expectedScanTag,
          expectedBinId: expectedBin.code,
          expectedPositionId: null,
          actualBinId: actualBin?.code ?? null,
          actualPositionId: null,
          status: PlacementConfirmationStatus.CONFIRMED,
          deviceId: device.id,
          operatorId,
          isOffline: true,
          confirmedAt: item.confirmedAt ?? new Date(),
          notes: item.notes ?? null,
        });

        // Link to SyncLog
        await binningRepository.updatePlacementConfirmationSyncLog(confirmation.id, syncLog.id);

        // Update plan line status to COMPLETED
        await binningRepository.updatePlanLineStatus(planLine.id, BinningPlanLineStatus.COMPLETED);

        // Update packet tag status to STORED
        await binningRepository.updatePacketTagStatus(packet.id, PacketTagStatus.STORED);

        // Log successful storage sync event
        await eventLogger.log({
          ref: packet.epc,
          eventType: EventType.PUT_AWAY_SYNCED,
          phase: "BINNING",
          device: device.deviceId,
          appUser: operatorId,
          payload: {
            planId: plan.planId,
            lineNo: planLine.lineNo,
            binCode: expectedBin.code,
            locationTagId: expectedScanTag,
            isOffline: true,
            syncLogId: syncLog.id.toString(),
          },
        });

        confirmationsUploaded++;
        results.push({
          packetEpc: packet.epc,
          packetTagId: packet.id.toString(),
          status: SyncResultStatus.SYNCED,
          message: "Placement confirmed successfully",
          confirmationId: confirmation.id.toString(),
          expectedLocation: expectedInfo,
          actualLocation: actualInfo,
        });
      } catch (err: unknown) {
        failedCount++;
        const errMsg = err instanceof Error ? err.message : "Unknown synchronisation error";
        results.push({
          packetEpc: item.packetEpc,
          packetTagId: item.packetTagId,
          status: SyncResultStatus.FAILED,
          message: errMsg,
        });
      }
    }

    // 5. Update SyncLog status based on results
    let finalStatus = SyncLogStatus.COMPLETED;
    if (failedCount === data.confirmations.length) {
      finalStatus = SyncLogStatus.FAILED;
    } else if (conflictsDetected > 0 || failedCount > 0) {
      finalStatus = SyncLogStatus.PARTIAL;
    }

    const updatedSyncLog = await binningRepository.updateSyncLog(syncLog.id, {
      completedAt: new Date(),
      status: finalStatus,
      confirmationsUploaded,
      conflictsDetected,
      metadata: {
        totalItems: data.confirmations.length,
        alreadySyncedCount,
        failedCount,
      },
    });

    // 6. Refresh handheld plan sync tracking state
    const download = await binningRepository.findPlanDownload(plan.id, device.id);
    if (download) {
      await binningRepository.updatePlanDownloadStatus(
        plan.id,
        device.id,
        PlanDownloadStatus.SYNCED,
        new Date(),
      );
    }

    const planSyncState = await binningRepository.updatePlanSyncState(plan.id, device.id, {
      lastSyncedAt: new Date(),
      lastConfirmedAt: confirmationsUploaded > 0 ? new Date() : undefined,
      pendingConfirmations: failedCount + conflictsDetected,
      lastError:
        finalStatus === SyncLogStatus.FAILED
          ? "All confirmations failed to sync"
          : conflictsDetected > 0
            ? "One or more confirmations require conflict resolution"
            : failedCount > 0
              ? "One or more confirmations failed to sync"
              : null,
    });

    // 7. Write audit log
    await writeAudit(auditCtx, {
      action: AuditAction.BINNING_SYNC_REDOCK,
      resource: AuditResource.SYNC_LOG,
      resourceId: syncLog.id.toString(),
      result: finalStatus === SyncLogStatus.FAILED ? AuditResult.FAILURE : AuditResult.SUCCESS,
      meta: {
        deviceId: device.deviceId,
        planId: plan.planId,
        status: finalStatus,
        uploaded: confirmationsUploaded,
        conflicts: conflictsDetected,
        alreadySynced: alreadySyncedCount,
        failed: failedCount,
      },
    });

    return {
      syncLog: toSyncLogDto(updatedSyncLog),
      totalProcessed: data.confirmations.length,
      confirmationsUploaded,
      conflictsDetected,
      alreadySyncedCount,
      failedCount,
      results,
      planSyncState: planSyncState
        ? {
            id: planSyncState.id.toString(),
            planId: planSyncState.planId.toString(),
            deviceId: planSyncState.deviceId.toString(),
            lastSyncedAt: planSyncState.lastSyncedAt,
            lastConfirmedAt: planSyncState.lastConfirmedAt,
            pendingConfirmations: planSyncState.pendingConfirmations,
            lastError: planSyncState.lastError,
            createdAt: planSyncState.createdAt,
            updatedAt: planSyncState.updatedAt,
          }
        : null,
    };
  },
};
