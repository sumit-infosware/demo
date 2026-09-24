import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { IFS_CONSTANTS } from "../constants/ifs.constants.js";

/**
 * IFS realtime notifications (Socket.IO).
 *
 * Exposes polling/gate-entry events on the `/ifs` namespace:
 *   poll.started, poll.success, poll.failed, poll.interval.changed,
 *   poll.failure.threshold.changed, poll.stopped, poll.restarted,
 *   gate-entry.detected, gate-entry.synced, rr-line.fetch-ready,
 *   rr-line.rejected, gate-entry.line.cancelled, rr-line.serials-missing,
 *   stock-verification.completed
 *
 * Payloads are sanitized before emission — DB credentials, connection
 * strings and any sensitive infra configuration are never emitted.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "url",
  "connectionstring",
  "dsn",
  "host",
  "port",
]);

const IFS_NAMESPACE = IFS_CONSTANTS.SOCKET_NAMESPACE;

let io: SocketServer | null = null;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
      out[key] = sanitize(val, depth + 1);
    }
    return out;
  }
  return value;
}

/** Attaches the Socket.IO server to the running HTTP server. Idempotent. */
export function initIfsRealtime(httpServer: HttpServer): SocketServer {
  if (io) return io;
  io = new SocketServer(httpServer, {
    path: "/socket.io",
    cors: { origin: env.corsOrigins, methods: ["GET", "POST"] },
  });
  const namespace = io.of(IFS_NAMESPACE);
  namespace.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "ifs:realtime:client_connected");
    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "ifs:realtime:client_disconnected");
    });
  });
  logger.info("ifs:realtime:initialized");
  return io;
}

/** Emits an event on the /ifs namespace with a sanitized payload. */
export function emitIfsEvent(event: string, payload: Record<string, unknown>): void {
  if (!io) return; // realtime not initialized (e.g. tests, worker-only mode)
  const safe = sanitize(payload) as Record<string, unknown>;
  io.of(IFS_NAMESPACE).emit(event, safe);
}

/** Returns the underlying Socket.IO server (for shutdown/cleanup). */
export function getIfsRealtime(): SocketServer | null {
  return io;
}

/** Closes the realtime server (used on shutdown). */
export async function closeIfsRealtime(): Promise<void> {
  if (!io) return;
  const server = io;
  io = null;
  await server.close();
}
