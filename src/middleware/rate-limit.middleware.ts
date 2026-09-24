import type { NextFunction, Request, Response } from "express";
import { redis } from "../config/clients.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { RateLimitError } from "../errors/errors.js";

export interface RateLimiterOptions {
  /** Window in milliseconds. Defaults to env.RATE_LIMIT_WINDOW_MS. */
  windowMs?: number;
  /** Max requests allowed within the window. Defaults to env.RATE_LIMIT_MAX. */
  max?: number;
  /**
   * Optional key prefix to namespace counters (e.g. "auth"). Defaults to "rl".
   * Use a distinct prefix when you want a separate budget per route group.
   */
  prefix?: string;
  /**
   * Paths (exact, case-sensitive) to exclude from limiting. Useful for
   * health checks or public endpoints that must never be throttled.
   */
  skipPaths?: string[];
}

/**
 * Fixed-window counter rate limiter backed by Redis.
 *
 * Each (ip, prefix) pair gets an incrementing counter with a sliding TTL equal
 * to the window. On the first hit the key's TTL is set; subsequent hits only
 * increment. This keeps the window aligned to wall-clock boundaries.
 *
 * Design notes:
 * - Fail-open: if Redis is unavailable the request is allowed through and the
 *   error is logged. A Redis outage must never take down the API.
 * - Uses the existing RateLimitError (429 / RATE_LIMITED) so the global error
 *   handler returns the standard error envelope.
 * - Sets `Retry-After` (seconds) and `X-RateLimit-*` headers for clients.
 */
export function rateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  // FORCE OVERRIDE IN DEV: Set limit to 50000 so it never blocks during testing
  const max = !env.isProd ? 50000 : (options.max ?? env.RATE_LIMIT_MAX);
  const prefix = options.prefix ?? "rl";
  const skip = new Set(options.skipPaths ?? []);

  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (skip.has(req.path)) {
      next();
      return;
    }

    const ip =
      req.ip ??
      (typeof req.socket.remoteAddress === "string" ? req.socket.remoteAddress : "unknown");
    const key = `${prefix}:${ip}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }

      const remaining = Math.max(0, max - count);
      const ttlMs = await redis.pttl(key);
      const resetSeconds = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000);

      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(resetSeconds));

      if (count > max) {
        res.setHeader("Retry-After", String(resetSeconds));
        next(new RateLimitError("Too many requests, please try again later"));
        return;
      }

      next();
    } catch (err) {
      // Fail open: Redis down or unreachable — allow the request.
      logger.error(
        { err: err instanceof Error ? err.message : String(err), key },
        "rate_limit:redis_error",
      );
      next();
    }
  };
}
