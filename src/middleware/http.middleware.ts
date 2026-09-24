import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ZodError } from "zod";
import { Prisma } from "../../prisma/generated/prisma/client.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../errors/errors.js";
import { errorBody } from "../http/ApiResponse.js";

/**
 * Zod validation middleware: validates a single request part.
 *
 * NOTE: Express 5 made `req.query` a read-only getter, so we can no longer
 * reassign `req.query = parsed`. Instead we mutate the object in place for
 * `query`, and keep direct assignment for `body` / `params` where it still
 * works. The mutation approach also works for `body` and `params`, so we use
 * it uniformly for safety.
 */
export const validate =
  <T>(schema: ZodType<T>, part: "body" | "query" | "params" = "body") =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(
        new AppError(
          "Validation failed",
          400,
          "VALIDATION_ERROR",
          result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        ),
      );
    }

    // Express 5: req.query is a getter — cannot reassign. Mutate in place.
    const target = req[part] as Record<string, unknown>;
    if (target && typeof target === "object") {
      // Clear existing keys, then copy parsed values in.
      for (const key of Object.keys(target)) {
        delete target[key];
      }
      Object.assign(target, result.data as Record<string, unknown>);
    } else {
      // Fallback for cases where the part is undefined (shouldn't happen
      // for validated requests, but keeps types happy).
      (req as unknown as Record<string, unknown>)[part] = result.data;
    }

    next();
  };

/** CSRF protection for cookie-authenticated mutations. */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.headers.authorization) return next(); // Bearer-token clients skip CSRF
  if (req.cookies?.refresh_token) {
    const origin = req.headers.origin ?? req.headers.referer ?? req.headers.host;
    const allowed = env.corsOrigins.some(
      (o) =>
        origin === o || origin === new URL(o).host || (origin as string).includes(new URL(o).host),
    );
    if (!allowed) {
      logger.error(
        { allowed: origin, hasHeader: req.header("x-requested-with") },
        "CSRF validation failed",
      );
      return next(new AppError("CSRF validation failed", 403, "CSRF_FAILED"));
    }
  }
  next();
}

/** Express error middleware — normalizes any thrown error into the envelope. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId;

  // Zod validation errors (e.g. from validate() or thrown directly).
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    logger.warn({ requestId, code: "VALIDATION_ERROR", details }, "validation failed");
    res
      .status(400)
      .json(errorBody(400, "VALIDATION_ERROR", "Validation failed", details, requestId));
    return;
  }

  // Known Prisma constraint / record errors.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      logger.warn({ requestId, code: "CONFLICT", target }, "unique constraint violation");
      res
        .status(409)
        .json(errorBody(409, "CONFLICT", `${target} already exists`, undefined, requestId));
      return;
    }
    if (err.code === "P2025") {
      logger.warn({ requestId, code: "NOT_FOUND" }, "record not found");
      res.status(404).json(errorBody(404, "NOT_FOUND", "Resource not found", undefined, requestId));
      return;
    }
  }

  const appErr = err instanceof AppError ? err : new AppError("Something went wrong", 500);
  const stack = env.isDev && appErr.statusCode >= 500 ? (err as Error)?.stack : undefined;

  // Log 5xx and unexpected errors with structured context; hide details from clients in production.
  if (appErr.statusCode >= 500) {
    logger.error(
      { requestId, code: appErr.code, statusCode: appErr.statusCode, err },
      appErr.message,
    );
  } else {
    logger.warn({ requestId, code: appErr.code, statusCode: appErr.statusCode }, appErr.message);
  }
  res
    .status(appErr.statusCode)
    .json(
      errorBody(appErr.statusCode, appErr.code, appErr.message, appErr.details, requestId, stack),
    );
}

/** Not-found handler. */
export function notFound(_req: Request, res: Response): void {
  res
    .status(404)
    .json(errorBody(404, "NOT_FOUND", "Route not found", undefined, undefined, undefined));
}
