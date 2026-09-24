import { Redis } from "ioredis";
import type { Prisma } from "../../prisma/generated/prisma/client.js";
import { PrismaClient } from "../../prisma/generated/prisma/client.js";

import { env } from "./env.js";
import { logger } from "./logger.js";

export const prisma = new PrismaClient({
  log: env.isDev
    ? [
        { emit: "event", level: "query" },
        { emit: "event", level: "error" },
      ]
    : [{ emit: "event", level: "error" }],
});

if (env.isDev) {
  prisma.$on("query", (e: Prisma.QueryEvent) => {
    logger.debug(
      {
        query: e.query,
        duration: e.duration,
      },
      "prisma:query",
    );
  });
}
/**
 * Redis client singleton.
 *
 * Used for cross-request state such as the rate limiter's fixed-window
 * counters. Connection errors are logged but never crash the process — the
 * rate limiter is designed to fail open (see rate-limit.middleware) so a Redis
 * outage does not take down the API.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  enableOfflineQueue: true,
  lazyConnect: true,
});

redis.on("error", (err: Error) => {
  logger.error({ err }, "redis:connection_error");
});

redis.on("connect", () => {
  logger.info({ url: env.REDIS_URL }, "redis:connected");
});
