import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { auditService } from "../services/audit.service.js";

export const listAuditLogsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await auditService.list({
      actorId: req.query.actorId as string | undefined,
      actorEmail: req.query.actorEmail as string | undefined,
      action: req.query.action as string | undefined,
      resource: req.query.resource as string | undefined,
      resourceId: req.query.resourceId as string | undefined,
      screen: req.query.screen as string | undefined,
      q: req.query.q as string | undefined,
      from: req.query.from ? new Date(req.query.from as string) : undefined,
      to: req.query.to ? new Date(req.query.to as string) : undefined,
      page,
      limit,
    });
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
