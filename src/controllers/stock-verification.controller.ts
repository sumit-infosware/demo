import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { stockVerificationService } from "../services/stock-verification.service.js";

/** POST /ifs/stock-verification/sync — handheld re-dock stock verification. */
export async function syncStockVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { deviceId, items } = req.body as {
      deviceId: string;
      items: Parameters<typeof stockVerificationService.syncFromHandheld>[0];
    };
    const result = await stockVerificationService.syncFromHandheld(
      items,
      deviceId,
      req.user!,
      req.auditCtx,
    );
    success(res, result, 201, req.requestId);
  } catch (err) {
    next(err);
  }
}

/** POST /ifs/stock-verification/run — admin-triggered manual reconciliation. */
export async function runStockVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { locationNo } = req.body as { locationNo: string };
    const result = await stockVerificationService.runManual(locationNo, req.user!, req.auditCtx);
    success(res, result, 201, req.requestId);
  } catch (err) {
    next(err);
  }
}

/** GET /ifs/stock-verification/runs — paginated run history. */
export async function listStockVerificationRuns(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, trigger, locationNo } = req.query as {
      page?: number;
      limit?: number;
      trigger?: string;
      locationNo?: string;
    };
    const result = await stockVerificationService.listRuns(
      { page: page ?? 1, limit: limit ?? 20, trigger, locationNo },
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (err) {
    next(err);
  }
}

/** GET /ifs/stock-verification/runs/:id — single run detail. */
export async function getStockVerificationRun(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const result = await stockVerificationService.getRun(id, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (err) {
    next(err);
  }
}
