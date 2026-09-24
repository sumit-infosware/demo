import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { holdingService } from "../services/holding.service.js";

export const scanArrival = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await holdingService.scanArrival(
      req.body as Parameters<typeof holdingService.scanArrival>[0],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const receive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await holdingService.receive(
      req.body as Parameters<typeof holdingService.receive>[0],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const reconcileAlternate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await holdingService.reconcileAlternate(
      req.body as Parameters<typeof holdingService.reconcileAlternate>[0],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const listPendingTransfers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await holdingService.listPendingTransfers(req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
