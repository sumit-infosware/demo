import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { transitService } from "../services/transit.service.js";

/**
 * Transit module controllers (Phase 3 — Transit Exit).
 * Thin controllers: parse request, delegate to transitService, return envelope.
 * Authorization is enforced at the route layer via requirePermission.
 */

export const readEpcs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = req.body as {
      readerId?: string;
      port?: number;
      epcs: string[];
    };
    const result = await transitService.readEpcs(data, req.user!, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
