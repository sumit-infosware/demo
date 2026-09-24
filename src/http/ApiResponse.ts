import type { Response } from "express";
import { toJsonSafe } from "../helpers/json-serializer.helper.js";

/** Consistent success envelope: { success: true, data, requestId? } */
export function success<T>(res: Response, data: T, status = 200, requestId?: string): Response {
  const body: Record<string, unknown> = { success: true, data };
  if (requestId) body.requestId = requestId;
  return res.status(status).json(toJsonSafe(body));
}

/** Consistent error envelope used by the error middleware. */
export function errorBody(
  _statusCode: number,
  code: string,
  message: string,
  details?: unknown,
  requestId?: string,
  stack?: string,
): Record<string, unknown> {
  const error: Record<string, unknown> = {
    code,
    message,
    ...(details !== undefined && { details }),
    ...(stack && { stack }),
  };
  const body: Record<string, unknown> = { success: false, error };
  if (requestId) body.requestId = requestId;
  return toJsonSafe(body) as Record<string, unknown>;
}
