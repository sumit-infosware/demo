import type { Request } from "express";

/**
 * Audit context for a single request.
 * Carries the identity of the acting user plus the requestId that is also
 * present in the Pino HTTP log, so a request can be traced from log line to
 * audit record via that id.
 */
export interface AuditContext {
  actorId?: string;
  actorEmail?: string;
  actorRole?: string[];
  requestId?: string;
  ip?: string;
  userAgent?: string;
  screen?: string;
}

import { AuditResult } from "../enums/audit.enum.js";
export { AuditResult };

/** Filter options for listing audit logs (all optional). */
export interface AuditLogFilter {
  actorId?: string;
  actorEmail?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
  screen?: string;
  result?: string;
}

/** Input for creating a single audit record. */
export interface AuditRecordInput {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditOptions {
  /** Action performed, e.g. "role.create", "auth.login". */
  action: string;
  /** Resource type acted upon, e.g. "role", "permission", "auth". */
  resource: string;
  /** Identifier of the affected resource, when applicable. */
  resourceId?: string | null;
  /**
   * Outcome of the operation. Defaults to AuditResult.SUCCESS.
   */
  result?: AuditResult;
  /** Arbitrary structured context (old/new values, error details, etc.). */
  meta?: Record<string, unknown>;
  screen?: string;
}

/**
 * Builds an AuditContext from the current Express request, reusing the
 * requestId assigned by requestIdMiddleware and the authenticated user
 * resolved by the `authenticate` helper.
 */
export function auditContextFromRequest(req: Request): AuditContext {
  return {
    actorId: req.user?.userId,
    actorEmail: req.user?.email,
    actorRole: req.user?.roles,
    requestId: req.requestId,
    ip: req.ip,
    userAgent:
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    screen: `${req.method} ${req.baseUrl || req.path}`,
  };
}
