import { prisma } from "../config/clients.js";
import { logger } from "../config/logger.js";

/**
 * Transfer ID (TID) generation helper (RF-24).
 *
 * Generates unique Transfer IDs in the format: TID-YYYYMMDD-NNNN
 * where NNNN is a daily sequence number padded to 4 digits.
 *
 * Uses a database sequence table to ensure uniqueness under concurrency.
 * The sequence is scoped by date so it resets daily.
 */

interface TransferSequenceRow {
  id: bigint;
  date: Date;
  sequence: number;
}

/** Get or create the daily sequence row and atomically increment it. */
async function getNextSequence(date: Date): Promise<number> {
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

  // Use a transaction with row-level locking to ensure atomicity
  return await prisma.$transaction(async (tx) => {
    // Try to find existing sequence for today
    const row = await tx.$queryRaw<TransferSequenceRow[]>`
      SELECT * FROM "transfer_sequence" WHERE "date" = ${dateStr}::date FOR UPDATE
    `;

    if (row.length === 0 || row[0] === undefined) {
      // Create new sequence row for today
      await tx.$executeRaw`
        INSERT INTO "transfer_sequence" ("date", "sequence") VALUES (${dateStr}::date, 1)
      `;
      return 1;
    }

    // Increment existing sequence
    const newSequence = (row[0]?.sequence ?? 0) + 1;
    await tx.$executeRaw`
      UPDATE "transfer_sequence" SET "sequence" = ${newSequence} WHERE "date" = ${dateStr}::date
    `;
    return newSequence;
  });
}

/** Generate a unique Transfer ID. */
export async function generateTransferId(): Promise<string> {
  const now = new Date();
  const isoDate = now.toISOString();
  const dateStr = isoDate.split("T")[0]?.replace(/-/g, "") ?? ""; // YYYYMMDD
  const sequence = await getNextSequence(now);
  const sequenceStr = sequence.toString().padStart(4, "0");
  return `TID-${dateStr}-${sequenceStr}`;
}

/**
 * Initialize the transfer_sequence table if it doesn't exist.
 * This should be called during application startup.
 */
export async function ensureTransferSequenceTable(): Promise<void> {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "transfer_sequence" (
        "id" BIGSERIAL PRIMARY KEY,
        "date" DATE NOT NULL UNIQUE,
        "sequence" INTEGER NOT NULL DEFAULT 1,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    logger.info("transfer_sequence table ensured");
  } catch (err) {
    logger.error({ err }, "Failed to ensure transfer_sequence table");
    throw err;
  }
}
