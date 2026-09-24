import { createPool, type Pool } from "mysql2/promise";
import type { EventEmitter } from "node:events";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import {
  IfsConnectionError,
  IfsQueryError,
  IfsReadOnlyViolationError,
} from "../errors/ifs.errors.js";

/**
 * IFS MySQL client — READ-ONLY.
 *
 * - Connects to the external IFS MySQL database (dummy/demo today, real IFS
 *   later) without any change to the rest of SITS.
 * - Only SELECT statements are ever executed; `query()` refuses anything that
 *   is not a read statement as defense-in-depth (the DB user must additionally
 *   be granted SELECT-only privileges).
 * - Lazy connect: the pool only opens sockets on first query. `init()` is
 *   called at startup to fail early logs but never crashes the API.
 */
export class IfsClient {
  private pool: Pool | null = null;

  /** Initializes the pool. Safe to call repeatedly. */
  init(): void {
    if (this.pool) return;
    logger.info({}, "ifs:client:initializing");
    this.pool = createPool({
      uri: env.IFS_DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 2,
      idleTimeout: 30_000,
      enableKeepAlive: true,
      // BIGINT columns arrive as strings (avoids precision loss).
      supportBigNumbers: true,
      bigNumberStrings: true,
      // DECIMAL columns arrive as strings by default in mysql2.
      decimalNumbers: false,
      // Read DATE/DATETIME values against UTC to match SITS Postgres timestamptz.
      timezone: "Z",
    });
    // The promise Pool typing only exposes a subset of events; the runtime
    // EventEmitter is used to observe pool-level errors.
    (this.pool as unknown as EventEmitter).on("error", (err: Error) => {
      logger.error({ err }, "ifs:client:pool_error");
    });
  }

  /** True once `init()` has been called. */
  isInitialized(): boolean {
    return this.pool !== null;
  }

  /**
   * Executes a read-only statement against IFS.
   * Throws IfsReadOnlyViolationError if the statement is not a SELECT/SHOW/DESC.
   */
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) this.init();
    const pool = this.pool;
    if (!pool) throw new IfsConnectionError();

    const trimmed = sql.trim().toUpperCase();
    if (!/^(SELECT|SHOW|DESC)\b/.test(trimmed)) {
      throw new IfsReadOnlyViolationError();
    }

    try {
      const [rows] = (await pool.query(sql, params)) as unknown as [T[], unknown];
      return rows;
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err), sql: trimmed.slice(0, 120) },
        "ifs:query_failed",
      );
      throw new IfsQueryError(err instanceof Error ? err.message : "IFS query failed");
    }
  }

  async ping(): Promise<void> {
    if (!this.pool) this.init();
    const pool = this.pool;
    if (!pool) throw new IfsConnectionError();
    try {
      const conn = await pool.getConnection();
      try {
        await conn.ping();
      } finally {
        conn.release();
      }
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, "ifs:ping_failed");
      throw new IfsConnectionError();
    }
  }

  async end(): Promise<void> {
    if (!this.pool) return;
    try {
      await this.pool.end();
    } catch (err) {
      logger.error({ err }, "ifs:client:close_failed");
    } finally {
      this.pool = null;
    }
  }
}

/** Singleton used across the application. */
export const ifsClient = new IfsClient();
