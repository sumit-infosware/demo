import type { NextFunction, Request, Response } from "express";
import { success } from "../http/ApiResponse.js";
import { rrService } from "../services/rr.service.js";

export const listRrs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const result = await rrService.listRrs({ page, limit }, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getRrById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await rrService.getRrById(id, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const getRrLineById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await rrService.getRrLineById(id, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const listRrLines = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as { rrId?: string; qcStatus?: string; taggableOnly?: string };
    const result = await rrService.listRrLines(
      { rrId: q.rrId, qcStatus: q.qcStatus, taggableOnly: q.taggableOnly === "true" },
      req.auditCtx,
    );
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};

export const checkSerials = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params as { id: string };
    const result = await rrService.checkSerialsForTagging(id, req.auditCtx);
    success(res, result, 200, req.requestId);
  } catch (e) {
    next(e);
  }
};
