import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { masterDataService } from "../services/master-data.service.js";

export async function listApprovedAlternates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await masterDataService.getApprovedAlternates(
      req.query.orderedItem as string | undefined,
    );
    success(res, result, 200, req.requestId);
  } catch (err) {
    next(err);
  }
}

export async function syncApprovedAlternates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body =
      req.body as import("../schemas/master-data.schemas.js").SyncApprovedAlternatesRequest;
    const result = await masterDataService.syncApprovedAlternates(body, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (err) {
    next(err);
  }
}

export async function listLocationMaster(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await masterDataService.getLocations(req.query.binId as string | undefined);
    success(res, result, 200, req.requestId);
  } catch (err) {
    next(err);
  }
}
