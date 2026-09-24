import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { transitDoorService } from "../services/transit-door.service.js";

/**
 * Transit Door module controllers (RF-26, RF-27, RF-28).
 * Thin controllers: parse request, delegate to transitDoorService, return envelope.
 * Authorization is enforced at the route layer via requirePermission.
 */

export const readEpcs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = req.body as {
      deviceId: string;
      epcs: string[];
    };
    const result = await transitDoorService.readEpcs(data, req.user!, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
