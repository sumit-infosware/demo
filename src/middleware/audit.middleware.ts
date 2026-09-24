import type { NextFunction, Request, Response } from "express";
import { auditContextFromRequest } from "../audit/audit.types.js";

/**
 * Captures the audit context for the current request and attaches it to
 * `req.auditCtx` so downstream controllers/services can write audit records
 * without re-deriving the acting user, request id, ip, and user-agent.
 *
 * Placed after authentication/authorization so `req.user` is populated.
 */
export function audit(req: Request, _res: Response, next: NextFunction): void {
  req.auditCtx = auditContextFromRequest(req);
  next();
}
