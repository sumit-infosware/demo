import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "../config/clients.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { stockVerificationService } from "./stock-verification.service.js";

/**
 * BullMQ periodic scheduler for stock verification (Phase 10).
 *
 * Policy is persisted in IfsPollingConfig under configKey "stock-verify"
 * (enabled + normalIntervalMs). The scheduler is a single repeatable BullMQ
 * scheduler that emits a `stock-verification.scheduled` job each interval;
 * the worker reconciles every known location (stored tags vs IFS stock mirror).
 */

export const STOCK_VERIFICATION_QUEUE_NAME = "ifs-stock-verification";
export const STOCK_VERIFICATION_SCHEDULER_ID = "ifs-stock-verification-scheduler";
export const STOCK_VERIFICATION_JOB_NAME = "stock-verification.scheduled";
export const STOCK_VERIFICATION_CONFIG_KEY = "stock-verify";

const DEFAULT_INTERVAL_MS = 86_400_000; // 24h

/** BullMQ requires its own ioredis connection with maxRetriesPerRequest: null. */
function createBullConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    lazyConnect: false,
  });
}

async function getConfig(): Promise<{ enabled: boolean; normalIntervalMs: number }> {
  let row = await prisma.ifsPollingConfig.findUnique({
    where: { configKey: STOCK_VERIFICATION_CONFIG_KEY },
  });
  if (!row) {
    row = await prisma.ifsPollingConfig.create({
      data: {
        configKey: STOCK_VERIFICATION_CONFIG_KEY,
        enabled: true,
        normalIntervalMs: DEFAULT_INTERVAL_MS,
      },
    });
  }
  return { enabled: row.enabled, normalIntervalMs: row.normalIntervalMs };
}

let workerInstance: Worker | null = null;
let workerConnection: Redis | null = null;
const queueConnection = createBullConnection();

export const stockVerificationQueue = new Queue(STOCK_VERIFICATION_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 500,
    removeOnFail: 500,
  },
});

async function reschedule(intervalMs: number): Promise<void> {
  await stockVerificationQueue.upsertJobScheduler(
    STOCK_VERIFICATION_SCHEDULER_ID,
    { every: intervalMs },
    {
      name: STOCK_VERIFICATION_JOB_NAME,
      data: { trigger: "scheduler" },
    },
  );
  logger.info({ intervalMs }, "ifs:stock-verification:scheduler_rescheduled");
}

export const stockVerificationScheduler = {
  /** Boot-time: start the worker and (re)arm the scheduler if enabled. */
  async initialize(): Promise<void> {
    const config = await getConfig();
    logger.info({ enabled: config.enabled }, "ifs:stock-verification:initialize");
    this.startWorker();
    if (config.enabled) {
      await reschedule(config.normalIntervalMs);
    } else {
      logger.info("ifs:stock-verification:not_scheduling (disabled)");
    }
  },

  startWorker(): void {
    if (workerInstance) return;
    workerConnection = createBullConnection();
    workerInstance = new Worker(
      STOCK_VERIFICATION_QUEUE_NAME,
      async () => {
        const runScheduled = stockVerificationService.runScheduled.bind(stockVerificationService);
        return runScheduled();
      },
      {
        connection: workerConnection,
        concurrency: 1,
        lockDuration: 60_000,
      },
    );
    workerInstance.on("failed", (job, err) => {
      logger.warn({ jobId: job?.id, err }, "ifs:stock-verification:job_failed");
    });
    workerInstance.on("error", (err) => {
      logger.error({ err }, "ifs:stock-verification:worker_error");
    });
    logger.info("ifs:stock-verification:worker_started");
  },

  async shutdown(): Promise<void> {
    if (workerInstance) {
      await workerInstance.close();
      workerInstance = null;
    }
    await stockVerificationQueue.close().catch(() => undefined);
    if (workerConnection) {
      await workerConnection.quit().catch(() => undefined);
      workerConnection = null;
    }
    await queueConnection.quit().catch(() => undefined);
  },
};
