import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { baselineService } from "../services/baseline.service.js";

export const captureBaseline = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await baselineService.capture(
      req.body as Parameters<typeof baselineService.capture>[0],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 201, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getBaseline = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { packetTagId } = req.params as { packetTagId: string };
    const result = await baselineService.getBaseline(packetTagId, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const listBaselines = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as {
      method?: string;
      varianceOnly?: string;
      page?: string;
      limit?: string;
    };
    const result = await baselineService.listBaselines(
      {
        method: q.method,
        varianceOnly: q.varianceOnly === "true",
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
