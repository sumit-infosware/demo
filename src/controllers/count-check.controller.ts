import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { countCheckService } from "../services/count-check.service.js";

export const captureCountCheck = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await countCheckService.capture(
      req.body as Parameters<typeof countCheckService.capture>[0],
      req.user!,
      req.auditCtx,
    );
    success(res, result, 201, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getCountCheck = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { packetTagId } = req.params as { packetTagId: string };
    const result = await countCheckService.getByPacketTagId(packetTagId, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const listCountChecks = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as { mismatchesOnly?: string; page?: string; limit?: string };
    const result = await countCheckService.listCountChecks(
      {
        mismatchesOnly: q.mismatchesOnly === "true",
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
