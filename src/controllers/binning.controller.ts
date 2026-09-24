import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { binningService } from "../services/binning.service.js";

export const getBinningPlanByPlanId = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { planId } = req.params as { planId: string };
    const result = await binningService.getPlanByPlanId(planId, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

export const getLatestBinningPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await binningService.getLatestActivePlan(req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

export const listBinningPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as { page?: string; limit?: string; status?: string };
    const result = await binningService.listPlans(
      {
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        status: q.status,
      },
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

// ===== RF-38: Plan Download Controller =====

/**
 * POST /api/binning-plans/:planId/download
 * Download a binning plan to a handheld device
 * Body: { deviceId: string, expiresInHours?: number }
 */
export const downloadPlanToDevice = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { planId } = req.params as { planId: string };
    const { deviceId, expiresInHours } = req.body as { deviceId: string; expiresInHours?: number };

    // Get user ID from auth context if available
    const downloadedBy = req.user?.userId;

    const result = await binningService.downloadPlanToDevice(
      planId,
      deviceId,
      downloadedBy,
      expiresInHours ?? 24,
      req.auditCtx,
    );
    success(res, result, 201, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

// ===== RF-39: Find Location Controllers =====

/**
 * GET /api/v1/binning/locations/find
 * Find location mapping by (binId + positionId), tagId, or (planId + lineNo)
 * Query: binId?, positionId?, tagId?, planId?, lineNo?
 */
export const findLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as {
      binId?: string;
      tagId?: string;
      planId?: string;
      lineNo?: string;
    };
    const result = await binningService.findLocation(
      {
        binId: q.binId,
        tagId: q.tagId,
        planId: q.planId,
        lineNo: q.lineNo !== undefined ? Number(q.lineNo) : undefined,
      },
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

/**
 * GET /api/v1/binning/locations/:tagId
 * Get location mapping directly by RFID tag ID (scanned on rack/slot)
 */
export const getLocationByTagId = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { tagId } = req.params as { tagId: string };
    const result = await binningService.getLocationByTagId(tagId, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

/**
 * GET /api/v1/binning/plans/:planId/lines/:lineNo/location
 * Get location mapping and slot guidance for a specific plan line
 */
export const getLocationForPlanLine = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { planId, lineNo } = req.params as { planId: string; lineNo: string };
    const result = await binningService.getLocationForPlanLine(
      planId,
      Number(lineNo),
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

// ===== RF-40: Place & Verify Controllers =====

/**
 * POST /api/v1/binning/place-verify
 * Verify and confirm packet placement in assigned slot (RF-40)
 */
export const placeAndVerify = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "User not authenticated" },
      });
      return;
    }

    const body = req.body as import("../types/binning.types.js").PlaceAndVerifyRequest;
    const result = await binningService.placeAndVerify(body, operatorId, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

// ===== RF-42: Sync on Re-dock Controllers =====

/**
 * POST /api/v1/binning/sync
 * Bulk upload offline confirmations on handheld re-dock
 */
export const syncRedock = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const operatorId = req.user?.userId;
    if (!operatorId) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "User not authenticated" },
      });
      return;
    }

    const body = req.body as import("../types/binning.types.js").SyncRedockRequest;
    const result = await binningService.syncRedock(body, operatorId, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

// ===== RF-37 (manual import): Plan Import/Activate Controllers =====

/**
 * POST /api/v1/binning/plans/import
 * Idempotent import of a binning plan as final data (DRAFT).
 * Body: { planId, version?, notes?, lines: [{ lineNo?, itemCode, expectedQty, binCode, notes? }] }
 */
export const importBinningPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const body = req.body as import("../types/binning.types.js").ImportBinningPlanRequest;
    const userId = req.user?.userId;
    const result = await binningService.importPlan(body, userId, req.auditCtx);
    success(res, result, 201, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

/**
 * POST /api/v1/binning/plans/:planId/activate
 * Promote a DRAFT plan to ACTIVE.
 */
export const activateBinningPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { planId } = req.params as { planId: string };
    const result = await binningService.activatePlan(planId, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

// ===== RF-41: Location ↔ RFID Mapping Controllers =====

/**
 * GET /api/v1/binning/locations
 * List bins across the storage hierarchy with filters + pagination.
 * Query: warehouse?, binCode?, rfid?, page?, pageSize?
 */
export const listLocations = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as {
      warehouse?: string;
      binCode?: string;
      rfid?: string;
      page?: string;
      pageSize?: string;
    };
    const result = await binningService.listLocations(
      {
        warehouse: q.warehouse,
        binCode: q.binCode,
        rfid: q.rfid,
        page: q.page !== undefined ? Number(q.page) : undefined,
        pageSize: q.pageSize !== undefined ? Number(q.pageSize) : undefined,
      },
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

/**
 * POST /api/v1/binning/locations/register
 * Bind a physical RFID tag to a hierarchical bin.
 * Body: { rfid, binCode }
 */
export const registerLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const body = req.body as import("../types/binning.types.js").RegisterLocationRequest;
    const operatorId = req.user?.userId;
    const result = await binningService.registerLocation(body, operatorId ?? "", req.auditCtx);
    success(res, result, 201, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};

/**
 * POST /api/v1/binning/locations/unregister
 * Release a physical RFID tag from the hierarchy.
 * Body: { rfid }
 */
export const unregisterLocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const body = req.body as import("../types/binning.types.js").UnregisterLocationRequest;
    const operatorId = req.user?.userId;
    const result = await binningService.unregisterLocation(body, operatorId ?? "", req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e: unknown) {
    next(e);
  }
};
