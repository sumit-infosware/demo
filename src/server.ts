import { createServer } from "node:http";
import { createApp } from "./app.js";
import { prisma, redis } from "./config/clients.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { ensureTransferSequenceTable } from "./helpers/transfer-id-generator.helper.js";
import { ifsPolling } from "./ifs/queues/poll.queue.js";
import { closeIfsRealtime, initIfsRealtime } from "./ifs/realtime/ifs-realtime.js";
import { stockVerificationScheduler } from "./services/stock-verification.scheduler.js";

async function main(): Promise<void> {
  const app = createApp();
  const server = createServer(app);

  try {
    await redis.connect();
  } catch (error) {
    logger.warn({ error }, "startup:redis_connect_failed");
  }

  // Initialize transfer_sequence table for TID generation
  try {
    await ensureTransferSequenceTable();
  } catch (error) {
    logger.error({ error }, "startup:transfer_sequence_table_failed");
  }

  // The physical storage hierarchy (Warehouse/Bay/Row/Tier/Bin) is seeded by
  // prisma/seed-sits.ts and kept in lock-step with IFS locations as gate
  // entries are polled (fetch.service → syncStorageHierarchy).

  // IFS realtime (Socket.IO on /ifs) — attaches to the running HTTP server.
  initIfsRealtime(server);

  // IFS integration: init read-only client + arm the BullMQ poll scheduler.
  // Non-fatal: if the IFS database is unavailable at boot, the poller escalates
  // per policy (and can be stopped/restarted via the admin API).
  if (env.IFS_POLLING_ENABLED) {
    ifsPolling.initialize().catch((error) => {
      logger.error({ error }, "startup:ifs_polling_init_failed");
    });
    // Phase 10 — periodic stock verification (own IfsPollingConfig row).
    stockVerificationScheduler.initialize().catch((error) => {
      logger.error({ error }, "startup:stock_verification_init_failed");
    });
  } else {
    logger.info("startup:ifs_polling_disabled");
  }

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "server:listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "shutdown:start");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await ifsPolling.shutdown().catch((error) => {
      logger.error({ error }, "shutdown:ifs_polling_close_failed");
    });
    await stockVerificationScheduler.shutdown().catch((error) => {
      logger.error({ error }, "shutdown:stock_verification_close_failed");
    });
    await closeIfsRealtime();
    await prisma.$disconnect().catch((error) => {
      logger.error({ error }, "shutdown:prisma_disconnect_failed");
    });
    await redis.quit().catch((error) => {
      logger.error({ error }, "shutdown:redis_disconnect_failed");
    });
    logger.info({ signal }, "shutdown:complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("uncaughtException", (e) => {
    logger.fatal({ err: e instanceof Error ? e.message : "unknown" }, "uncaughtException");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal(
      { err: reason instanceof Error ? reason.message : String(reason) },
      "unhandledRejection",
    );
  });
}

void main();
