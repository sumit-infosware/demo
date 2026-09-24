import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { varianceService } from "../services/variance.service.js";

export const listVariances = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as {
      context?: string;
      disposition?: string;
      page?: string;
      limit?: string;
    };
    const result = await varianceService.listVariances(
      {
        context: q.context,
        disposition: q.disposition,
        page: Number(q.page ?? 1),
        limit: Number(q.limit ?? 20),
      },
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getVariance = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await varianceService.getVariance(id, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const resolveVariance = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await varianceService.resolveVariance(
      id,
      req.body as Parameters<typeof varianceService.resolveVariance>[1],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
