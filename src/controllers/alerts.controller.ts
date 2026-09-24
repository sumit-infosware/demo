import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { alertsService } from "../services/alerts.service.js";

export const listAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as {
      type?: string;
      severity?: string;
      status?: string;
      unreadOnly?: string;
      page?: string;
      limit?: string;
    };
    const result = await alertsService.listAlerts(
      {
        type: q.type,
        severity: q.severity,
        status: q.status,
        unreadOnly: q.unreadOnly === "true",
        page: Number(q.page ?? 1),
        limit: Number(q.limit ?? 20),
      },
      req.user!,
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const acknowledgeAlert = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await alertsService.acknowledgeAlert(id, req.user!, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
