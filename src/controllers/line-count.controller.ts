import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { lineCountService } from "../services/line-count.service.js";

export const captureLineCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await lineCountService.capture(
      req.body as Parameters<typeof lineCountService.capture>[0],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 201, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getLatestLineCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rrLineId } = req.params as { rrLineId: string };
    const result = await lineCountService.getLatest(rrLineId);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const listLineCountsByLine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rrLineId } = req.params as { rrLineId: string };
    const result = await lineCountService.listByLine(rrLineId);
    success(res, { rrLineId, counts: result, total: result.length }, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
