import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { prisma } from "../config/clients.js";
import {
  BinningPlanLineStatus,
  BinningPlanStatus,
  PacketTagStatus,
  PlacementConfirmationStatus,
  PlanDownloadStatus,
  SyncLogStatus,
} from "../enums/status.enum.js";

const binningPlanLineSelect = {
  id: true,
  planId: true,
  lineNo: true,
  rrLineId: true,
  packetTagId: true,
  itemCode: true,
  expectedQty: true,
  binId: true,
  positionId: true,
  locationTagId: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const binningPlanSelect = {
  id: true,
  planId: true,
  version: true,
  status: true,
  source: true,
  fetchedBy: true,
  fetchedAt: true,
  activatedAt: true,
  archivedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  lines: {
    select: binningPlanLineSelect,
    orderBy: { lineNo: "asc" },
  },
} as const;

const binningPlanListSelect = {
  ...binningPlanSelect,
  lines: false,
} as const;

const planDownloadSelect = {
  id: true,
  planId: true,
  deviceId: true,
  downloadedAt: true,
  downloadedBy: true,
  status: true,
  syncedAt: true,
  expiresAt: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
} as const;

const planSyncStateSelect = {
  id: true,
  planId: true,
  deviceId: true,
  lastSyncedAt: true,
  lastConfirmedAt: true,
  pendingConfirmations: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
} as const;

const placementConfirmationSelect = {
  id: true,
  planLineId: true,
  packetTagId: true,
  expectedLocationTagId: true,
  actualLocationTagId: true,
  expectedBinId: true,
  expectedPositionId: true,
  actualBinId: true,
  actualPositionId: true,
  status: true,
  mismatchReason: true,
  deviceId: true,
  operatorId: true,
  isOffline: true,
  confirmedAt: true,
  syncedAt: true,
  syncLogId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const syncLogSelect = {
  id: true,
  deviceId: true,
  startedAt: true,
  completedAt: true,
  status: true,
  confirmationsUploaded: true,
  conflictsDetected: true,
  errorMessage: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type RawSyncLog = {
  id: bigint;
  deviceId: bigint;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  confirmationsUploaded: number;
  conflictsDetected: number;
  errorMessage: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

// Define raw types matching the Prisma select structure
// These are the raw database return types before DTO conversion
export type RawPlacementConfirmation = {
  id: bigint;
  planLineId: bigint;
  packetTagId: bigint;
  expectedLocationTagId: string;
  actualLocationTagId: string | null;
  expectedBinId: string;
  expectedPositionId: string | null;
  actualBinId: string | null;
  actualPositionId: string | null;
  status: string;
  mismatchReason: string | null;
  deviceId: bigint;
  operatorId: string;
  isOffline: boolean;
  confirmedAt: Date;
  syncedAt: Date | null;
  syncLogId: bigint | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RawBinningPlanLine = {
  id: bigint;
  planId: bigint;
  lineNo: number;
  rrLineId: bigint | null;
  packetTagId: bigint | null;
  itemCode: string;
  expectedQty: { toString(): string };
  binId: string;
  positionId: string | null;
  locationTagId: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RawBinningPlanWithLines = {
  id: bigint;
  planId: string;
  version: number;
  status: string;
  source: string;
  fetchedBy: string | null;
  fetchedAt: Date;
  activatedAt: Date | null;
  archivedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: RawBinningPlanLine[];
};

export type RawBinningPlanListItem = Omit<RawBinningPlanWithLines, "lines">;

export type RawPlanDownload = {
  id: bigint;
  planId: bigint;
  deviceId: bigint;
  downloadedAt: Date;
  downloadedBy: string | null;
  status: string;
  syncedAt: Date | null;
  expiresAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RawPlanSyncState = {
  id: bigint;
  planId: bigint;
  deviceId: bigint;
  lastSyncedAt: Date;
  lastConfirmedAt: Date | null;
  pendingConfirmations: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Module-scope select for the Tier path (warehouse → bay → row → tier).
 * Reused by RF-39 bin/tier lookups so a scanned tier tag can resolve the
 * full path without over-fetching the entire hierarchy.
 */
const tierPathSelect = {
  code: true,
  name: true,
  tierRfid: true,
  row: {
    select: {
      code: true,
      bay: { select: { code: true, warehouse: { select: { code: true } } } },
    },
  },
} as const;

export const binningRepository = {
  /**
   * Fetch the active binning plan by planId (IFS plan identifier)
   */
  findPlanByPlanId: (planId: string): Promise<RawBinningPlanWithLines | null> =>
    prisma.binningPlan.findUnique({
      where: { planId },
      select: binningPlanSelect,
    }),

  /**
   * Fetch binning plan by database numeric ID
   */
  findPlanById: (id: bigint): Promise<RawBinningPlanWithLines | null> =>
    prisma.binningPlan.findUnique({
      where: { id },
      select: binningPlanSelect,
    }),

  /**
   * Fetch the latest active binning plan
   */
  findLatestActivePlan: (): Promise<RawBinningPlanWithLines | null> =>
    prisma.binningPlan.findFirst({
      where: { status: BinningPlanStatus.ACTIVE },
      orderBy: { version: "desc" },
      select: binningPlanSelect,
    }),

  /**
   * List all binning plans with optional filters
   */
  listPlans: (filters: {
    status?: string;
    skip?: number;
    take?: number;
  }): Promise<RawBinningPlanListItem[]> => {
    const { status, skip = 0, take = 20 } = filters;
    return prisma.binningPlan.findMany({
      where: {
        ...(status && { status }),
      },
      select: binningPlanListSelect,
      orderBy: { fetchedAt: "desc" },
      skip,
      take,
    });
  },

  /**
   * Count binning plans with optional filters
   */
  countPlans: (filters: { status?: string }): Promise<number> => {
    const { status } = filters;
    return prisma.binningPlan.count({
      where: {
        ...(status && { status }),
      },
    });
  },

  // ===== RF-37 (manual import): Plan import/activate methods =====

  /**
   * Idempotent plan import: upserts the plan (DRAFT, source IMPORT) and its
   * lines keyed on (planId, lineNo). Lines absent from the payload are
   * removed, since an import always carries the full final plan.
   */
  importBinningPlan: async (data: {
    planId: string;
    version?: number;
    notes?: string | null;
    fetchedBy?: string | null;
    lines: Array<{
      lineNo: number;
      itemCode: string;
      expectedQty: Prisma.Decimal;
      binCode: string;
      notes?: string | null;
    }>;
  }): Promise<{ plan: RawBinningPlanWithLines; createdLines: number; updatedLines: number }> => {
    const { createdLines, updatedLines } = await prisma.$transaction(async (tx) => {
      const plan = await tx.binningPlan.upsert({
        where: { planId: data.planId },
        create: {
          planId: data.planId,
          version: data.version ?? 1,
          status: BinningPlanStatus.DRAFT,
          source: "IMPORT",
          fetchedBy: data.fetchedBy ?? null,
          fetchedAt: new Date(),
          notes: data.notes ?? null,
        },
        update: {
          ...(data.version !== undefined && { version: data.version }),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.fetchedBy !== undefined && { fetchedBy: data.fetchedBy }),
        },
        select: { id: true },
      });

      const lineNos = data.lines.map((l) => l.lineNo);
      const existingLines = await tx.binningPlanLine.findMany({
        where: { planId: plan.id, lineNo: { in: lineNos } },
        select: { lineNo: true },
      });
      const existingSet = new Set(existingLines.map((l) => l.lineNo));

      let created = 0;
      let updated = 0;
      for (const line of data.lines) {
        await tx.binningPlanLine.upsert({
          where: {
            planId_lineNo: { planId: plan.id, lineNo: line.lineNo },
          },
          create: {
            planId: plan.id,
            lineNo: line.lineNo,
            itemCode: line.itemCode,
            expectedQty: line.expectedQty,
            binId: line.binCode,
            positionId: null,
            locationTagId: null,
            status: BinningPlanLineStatus.PENDING,
            notes: line.notes ?? null,
          },
          update: {
            itemCode: line.itemCode,
            expectedQty: line.expectedQty,
            binId: line.binCode,
            notes: line.notes ?? null,
          },
        });
        if (existingSet.has(line.lineNo)) {
          updated++;
        } else {
          created++;
        }
      }

      await tx.binningPlanLine.deleteMany({
        where: { planId: plan.id, lineNo: { notIn: lineNos } },
      });

      return { createdLines: created, updatedLines: updated };
    });

    const plan = await prisma.binningPlan.findUnique({
      where: { planId: data.planId },
      select: binningPlanSelect,
    });
    if (!plan) {
      throw new Error(`Binning plan ${data.planId} missing after import`);
    }

    return { plan, createdLines, updatedLines };
  },

  /**
   * Promote a DRAFT plan to ACTIVE. Returns null when the plan is unknown.
   */
  activateBinningPlan: async (planId: string): Promise<RawBinningPlanWithLines | null> => {
    const plan = await prisma.binningPlan.findUnique({
      where: { planId },
      select: { id: true, status: true },
    });
    if (!plan) return null;
    if (plan.status !== "DRAFT") return null;

    await prisma.binningPlan.update({
      where: { id: plan.id },
      data: { status: BinningPlanStatus.ACTIVE, activatedAt: new Date() },
    });

    return prisma.binningPlan.findUnique({
      where: { planId },
      select: binningPlanSelect,
    });
  },

  // ===== RF-38: Plan Download methods =====

  /**
   * Find a device by deviceId (string identifier)
   */
  findDeviceByDeviceId: (deviceId: string) =>
    prisma.deviceRegistry.findUnique({
      where: { deviceId },
      select: {
        id: true,
        deviceId: true,
        deviceType: true,
        isActive: true,
        controllerHost: true,
        controllerPort: true,
        controllerProtocol: true,
        machineIdOnController: true,
        endpointPath: true,
      },
    }),

  /**
   * Check if a plan is already downloaded to a device
   */
  findPlanDownload: (planId: bigint, deviceId: bigint) =>
    prisma.planDownload.findUnique({
      where: {
        planId_deviceId: {
          planId,
          deviceId,
        },
      },
      select: planDownloadSelect,
    }),

  /**
   * Create a plan download record
   */
  createPlanDownload: (data: {
    planId: bigint;
    deviceId: bigint;
    downloadedBy?: string | null;
    expiresAt?: Date | null;
  }) =>
    prisma.planDownload.create({
      data: {
        planId: data.planId,
        deviceId: data.deviceId,
        downloadedBy: data.downloadedBy ?? null,
        expiresAt: data.expiresAt ?? null,
        status: PlanDownloadStatus.DOWNLOADED,
      },
      select: planDownloadSelect,
    }),

  /**
   * Get or create sync state for a plan/device combination
   */
  upsertPlanSyncState: (planId: bigint, deviceId: bigint) =>
    prisma.planSyncState.upsert({
      where: {
        planId_deviceId: {
          planId,
          deviceId,
        },
      },
      create: {
        planId,
        deviceId,
        pendingConfirmations: 0,
      },
      update: {
        lastSyncedAt: new Date(),
      },
      select: planSyncStateSelect,
    }),

  /**
   * Find sync state for a plan/device
   */
  findPlanSyncState: (planId: bigint, deviceId: bigint) =>
    prisma.planSyncState.findUnique({
      where: {
        planId_deviceId: {
          planId,
          deviceId,
        },
      },
      select: planSyncStateSelect,
    }),

  /**
   * List plan downloads with filters
   */
  listPlanDownloads: (filters: {
    planId?: bigint;
    deviceId?: bigint;
    status?: string;
    skip?: number;
    take?: number;
  }): Promise<RawPlanDownload[]> => {
    const { planId, deviceId, status, skip = 0, take = 20 } = filters;
    return prisma.planDownload.findMany({
      where: {
        ...(planId && { planId }),
        ...(deviceId && { deviceId }),
        ...(status && { status }),
      },
      select: planDownloadSelect,
      orderBy: { downloadedAt: "desc" },
      skip,
      take,
    });
  },

  /**
   * Count plan downloads with filters
   */
  countPlanDownloads: (filters: {
    planId?: bigint;
    deviceId?: bigint;
    status?: string;
  }): Promise<number> => {
    const { planId, deviceId, status } = filters;
    return prisma.planDownload.count({
      where: {
        ...(planId && { planId }),
        ...(deviceId && { deviceId }),
        ...(status && { status }),
      },
    });
  },

  // ===== RF-39: Find Location methods =====

  /**
   * Resolve a Bin by its code (physical slot) with the full
   * warehouse → bay → row → tier → bin path. The Tier carries the
   * parent-level RFID tag for fallback scans.
   */
  findBinByCode: (binCode: string) =>
    prisma.bin.findFirst({
      where: { code: binCode },
      orderBy: { id: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        binRfid: true,
        tierId: true,
        tier: { select: tierPathSelect },
      },
    }),

  /**
   * Resolve a Bin by a scanned RFID tag (binRfid). Preferred over the tier
   * tag: "if both are present, use the bin tag".
   */
  findBinByRfid: (rfid: string) =>
    prisma.bin.findFirst({
      where: { binRfid: rfid },
      select: {
        id: true,
        code: true,
        name: true,
        binRfid: true,
        tierId: true,
        tier: { select: tierPathSelect },
      },
    }),

  /**
   * Resolve a Tier by a scanned RFID tag (tierRfid) — fallback when the
   * scanned tag is not bound to a specific bin.
   */
  findTierByRfid: (rfid: string) =>
    prisma.tier.findFirst({
      where: { tierRfid: rfid },
      select: {
        id: true,
        code: true,
        name: true,
        tierRfid: true,
        row: {
          select: {
            code: true,
            bay: { select: { code: true, warehouse: { select: { code: true } } } },
          },
        },
      },
    }),

  /**
   * Find a specific plan line by planId (string) and lineNo (number)
   */
  findPlanLineByPlanIdAndLineNo: async (
    planId: string,
    lineNo: number,
  ): Promise<(RawBinningPlanLine & { plan: { planId: string; status: string } }) | null> => {
    const plan = await prisma.binningPlan.findUnique({
      where: { planId },
      select: { id: true, planId: true, status: true },
    });
    if (!plan) return null;

    const line = await prisma.binningPlanLine.findUnique({
      where: {
        planId_lineNo: {
          planId: plan.id,
          lineNo,
        },
      },
      select: binningPlanLineSelect,
    });

    if (!line) return null;

    return {
      ...line,
      plan: {
        planId: plan.planId,
        status: plan.status,
      },
    };
  },

  // Bin listing lives with the hierarchy owner:
  // storage-hierarchy.service.ts (listBins / countBins).
  // ===== RF-40: Place & Verify methods =====

  /**
   * Find packet tag by EPC
   */
  findPacketByEpc: (epc: string) =>
    prisma.packetTag.findUnique({
      where: { epc },
      select: {
        id: true,
        epc: true,
        itemCode: true,
        packetNo: true,
        qty: true,
        uom: true,
        status: true,
      },
    }),

  /**
   * Find packet tag by ID
   */
  findPacketById: (id: bigint) =>
    prisma.packetTag.findUnique({
      where: { id },
      select: {
        id: true,
        epc: true,
        itemCode: true,
        packetNo: true,
        qty: true,
        uom: true,
        status: true,
      },
    }),

  /**
   * Find active binning plan line for a packet
   */
  findActivePlanLineForPacket: async (params: {
    packetTagId: bigint;
    itemCode: string;
    planId?: string;
  }) => {
    const { packetTagId, itemCode, planId } = params;

    // Build plan where condition
    const planWhere = planId
      ? { planId, status: BinningPlanStatus.ACTIVE }
      : { status: BinningPlanStatus.ACTIVE };

    // 1. Try matching by specific packetTagId on an active plan
    let line = await prisma.binningPlanLine.findFirst({
      where: {
        packetTagId,
        plan: planWhere,
      },
      select: {
        ...binningPlanLineSelect,
        plan: {
          select: { id: true, planId: true, version: true, status: true },
        },
      },
    });

    // 2. If not found by packetTagId, try matching by itemCode and PENDING status
    if (!line) {
      line = await prisma.binningPlanLine.findFirst({
        where: {
          itemCode,
          plan: planWhere,
          status: BinningPlanLineStatus.PENDING,
        },
        select: {
          ...binningPlanLineSelect,
          plan: {
            select: { id: true, planId: true, version: true, status: true },
          },
        },
        orderBy: { lineNo: "asc" },
      });
    }

    return line;
  },

  /**
   * Check for an existing placement confirmation for idempotency
   */
  findExistingPlacementConfirmation: (planLineId: bigint, packetTagId: bigint) =>
    prisma.placementConfirmation.findFirst({
      where: {
        planLineId,
        packetTagId,
        status: PlacementConfirmationStatus.CONFIRMED,
      },
      select: placementConfirmationSelect,
    }),

  findAnyPlacementConfirmation: (planLineId: bigint, packetTagId: bigint) =>
    prisma.placementConfirmation.findFirst({
      where: { planLineId, packetTagId },
      orderBy: { confirmedAt: "desc" },
      select: placementConfirmationSelect,
    }),

  /**
   * Create a placement confirmation record
   */
  createPlacementConfirmation: (data: {
    planLineId: bigint;
    packetTagId: bigint;
    expectedLocationTagId: string;
    actualLocationTagId?: string | null;
    expectedBinId: string;
    expectedPositionId: string | null;
    actualBinId?: string | null;
    actualPositionId?: string | null;
    status: string;
    mismatchReason?: string | null;
    deviceId: bigint;
    operatorId: string;
    isOffline?: boolean;
    confirmedAt?: Date;
    notes?: string | null;
  }): Promise<RawPlacementConfirmation> =>
    prisma.placementConfirmation.create({
      data: {
        planLineId: data.planLineId,
        packetTagId: data.packetTagId,
        expectedLocationTagId: data.expectedLocationTagId,
        actualLocationTagId: data.actualLocationTagId ?? null,
        expectedBinId: data.expectedBinId,
        expectedPositionId: data.expectedPositionId,
        actualBinId: data.actualBinId ?? null,
        actualPositionId: data.actualPositionId ?? null,
        status: data.status,
        mismatchReason: data.mismatchReason ?? null,
        deviceId: data.deviceId,
        operatorId: data.operatorId,
        isOffline: data.isOffline ?? false,
        confirmedAt: data.confirmedAt ?? new Date(),
        notes: data.notes ?? null,
      },
      select: placementConfirmationSelect,
    }),

  confirmPlacement: async (data: {
    planLineId: bigint;
    packetTagId: bigint;
    expectedLocationTagId: string;
    actualLocationTagId: string;
    expectedBinId: string;
    expectedPositionId: string | null;
    actualBinId: string | null;
    actualPositionId: string | null;
    deviceId: bigint;
    operatorId: string;
    isOffline: boolean;
    confirmedAt: Date;
    notes: string | null;
  }): Promise<RawPlacementConfirmation> =>
    prisma.$transaction(async (tx) => {
      const confirmation = await tx.placementConfirmation.create({
        data: {
          planLineId: data.planLineId,
          packetTagId: data.packetTagId,
          expectedLocationTagId: data.expectedLocationTagId,
          actualLocationTagId: data.actualLocationTagId,
          expectedBinId: data.expectedBinId,
          expectedPositionId: data.expectedPositionId,
          actualBinId: data.actualBinId,
          actualPositionId: data.actualPositionId,
          status: PlacementConfirmationStatus.CONFIRMED,
          deviceId: data.deviceId,
          operatorId: data.operatorId,
          isOffline: data.isOffline,
          confirmedAt: data.confirmedAt,
          notes: data.notes,
        },
        select: placementConfirmationSelect,
      });

      await tx.binningPlanLine.update({
        where: { id: data.planLineId },
        data: { status: BinningPlanLineStatus.COMPLETED },
      });
      await tx.packetTag.update({
        where: { id: data.packetTagId },
        data: { status: PacketTagStatus.STORED },
      });

      return confirmation;
    }),

  /**
   * Update binning plan line status
   */
  updatePlanLineStatus: (id: bigint, status: string) =>
    prisma.binningPlanLine.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    }),

  /**
   * Update packet tag status
   */
  updatePacketTagStatus: (id: bigint, status: string) =>
    prisma.packetTag.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    }),

  /**
   * Find placement confirmation by ID
   */
  findPlacementConfirmationById: (id: bigint): Promise<RawPlacementConfirmation | null> =>
    prisma.placementConfirmation.findUnique({
      where: { id },
      select: placementConfirmationSelect,
    }),

  /**
   * List placement confirmations with filters
   */
  listPlacementConfirmations: (filters: {
    planId?: bigint;
    deviceId?: bigint;
    status?: string;
    isOffline?: boolean;
    skip?: number;
    take?: number;
  }): Promise<RawPlacementConfirmation[]> => {
    const { planId, deviceId, status, isOffline, skip = 0, take = 20 } = filters;
    return prisma.placementConfirmation.findMany({
      where: {
        ...(planId && { planLine: { planId } }),
        ...(deviceId && { deviceId }),
        ...(status && { status }),
        ...(isOffline !== undefined && { isOffline }),
      },
      select: placementConfirmationSelect,
      orderBy: { confirmedAt: "desc" },
      skip,
      take,
    });
  },

  /**
   * Count placement confirmations with filters
   */
  countPlacementConfirmations: (filters: {
    planId?: bigint;
    deviceId?: bigint;
    status?: string;
    isOffline?: boolean;
  }): Promise<number> => {
    const { planId, deviceId, status, isOffline } = filters;
    return prisma.placementConfirmation.count({
      where: {
        ...(planId && { planLine: { planId } }),
        ...(deviceId && { deviceId }),
        ...(status && { status }),
        ...(isOffline !== undefined && { isOffline }),
      },
    });
  },

  // ===== RF-42: Sync on Re-dock methods =====

  /**
   * Create a new sync log entry
   */
  createSyncLog: (data: {
    deviceId: bigint;
    status?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<RawSyncLog> =>
    prisma.syncLog.create({
      data: {
        deviceId: data.deviceId,
        status: data.status ?? SyncLogStatus.IN_PROGRESS,
        metadata: data.metadata !== undefined ? data.metadata : undefined,
      },
      select: syncLogSelect,
    }),

  /**
   * Update sync log details
   */
  updateSyncLog: (
    id: bigint,
    data: {
      completedAt?: Date | null;
      status?: string;
      confirmationsUploaded?: number;
      conflictsDetected?: number;
      errorMessage?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<RawSyncLog> =>
    prisma.syncLog.update({
      where: { id },
      data,
      select: syncLogSelect,
    }),

  /**
   * Find sync log by database ID
   */
  findSyncLogById: (id: bigint): Promise<RawSyncLog | null> =>
    prisma.syncLog.findUnique({
      where: { id },
      select: syncLogSelect,
    }),

  /**
   * List sync log entries with pagination and device filters
   */
  listSyncLogs: (filters: {
    deviceId?: bigint;
    status?: string;
    skip: number;
    take: number;
  }): Promise<RawSyncLog[]> => {
    const { deviceId, status, skip, take } = filters;
    return prisma.syncLog.findMany({
      where: {
        ...(deviceId && { deviceId }),
        ...(status && { status }),
      },
      select: syncLogSelect,
      orderBy: { startedAt: "desc" },
      skip,
      take,
    });
  },

  /**
   * Count sync log entries
   */
  countSyncLogs: (filters: { deviceId?: bigint; status?: string }): Promise<number> => {
    const { deviceId, status } = filters;
    return prisma.syncLog.count({
      where: {
        ...(deviceId && { deviceId }),
        ...(status && { status }),
      },
    });
  },

  /**
   * Update the status of a plan download (e.g. status='SYNCED')
   */
  updatePlanDownloadStatus: (
    planId: bigint,
    deviceId: bigint,
    status: string,
    syncedAt?: Date | null,
  ) =>
    prisma.planDownload.update({
      where: {
        planId_deviceId: {
          planId,
          deviceId,
        },
      },
      data: {
        status,
        ...(syncedAt !== undefined && { syncedAt }),
      },
      select: planDownloadSelect,
    }),

  /**
   * Update the sync state details for a plan/device combination
   */
  updatePlanSyncState: (
    planId: bigint,
    deviceId: bigint,
    data: {
      lastSyncedAt?: Date;
      lastConfirmedAt?: Date | null;
      pendingConfirmations?: number;
      lastError?: string | null;
    },
  ) =>
    prisma.planSyncState.update({
      where: {
        planId_deviceId: {
          planId,
          deviceId,
        },
      },
      data,
      select: planSyncStateSelect,
    }),

  /**
   * Link a placement confirmation to a sync log
   */
  updatePlacementConfirmationSyncLog: (
    id: bigint,
    syncLogId: bigint,
  ): Promise<RawPlacementConfirmation> =>
    prisma.placementConfirmation.update({
      where: { id },
      data: { syncLogId },
      select: placementConfirmationSelect,
    }),
};
