import compression from "compression";
import cors from "cors";
import type { Router } from "express";
import helmet from "helmet";
import { env } from "../config/env.js";

/** Applies helmet + CORS + compression on a router. */
export function applySecurity(router: Router): void {
  router.use(helmet());
  router.use(
    cors({
      origin: env.isProd ? env.corsOrigins : true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-Id"],
      maxAge: 600,
    }),
  );
  router.use(compression());
}
