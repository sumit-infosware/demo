import type { IncomingMessage, ServerResponse } from "http";
import { pinoHttp } from "pino-http";
import { logger } from "../config/logger.js";

/**
 * HTTP request logging middleware built on `pino-http`, reusing the
 * application's existing Pino `logger` instance (and its redaction rules).
 *
 * The request id assigned by `requestIdMiddleware` is reused as the Pino
 * request id so every log line and audit record for a request share the
 * same correlation id.
 *
 * Request/response serializers intentionally omit headers to avoid leaking
 * sensitive values (authorization, cookies) even though the base logger
 * already redacts top-level secret keys.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) =>
    (req as { requestId?: string }).requestId ?? crypto.randomUUID(),
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (err) return "error";
    if (res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req: (req: IncomingMessage) => ({
      id: (req as { id?: string }).id,
      method: req.method,
      url: req.url,
      ip: (req as { ip?: string }).ip,
    }),
    res: (res: ServerResponse) => ({
      statusCode: res.statusCode,
    }),
  },
});
