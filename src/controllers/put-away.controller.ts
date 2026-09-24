import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { putAwayService } from "../services/put-away.service.js";

export const sync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId, items } = req.body as {
      deviceId: string;
      items: Parameters<typeof putAwayService.syncFromHandheld>[0];
    };
    const result = await putAwayService.syncFromHandheld(items, deviceId, req.user!, req.auditCtx);
    success(res, result, 201, req.requestId);
  } catch (e) {
    next(e);
  }
};
