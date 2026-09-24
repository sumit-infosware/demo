import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

/** Assigns/echoes a request id and exposes it on X-Request-Id. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const id = incoming && incoming.length <= 64 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
