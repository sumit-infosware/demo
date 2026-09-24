import cookieParser from "cookie-parser";
import express from "express";
import path from "node:path";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec } from "./config/swagger.js";
import { csrfProtection, errorHandler, notFound } from "./middleware/http.middleware.js";
import { rateLimiter } from "./middleware/rate-limit.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { requestLogger } from "./middleware/request-logger.middleware.js";
import { applySecurity } from "./middleware/security.middleware.js";
import { appRouter } from "./routes/index.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  applySecurity(app);
  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(cookieParser());
  app.use(express.json({ limit: "5mb" })); // 🆕 raised for base64 photos
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));
  app.use(csrfProtection);
  app.use(rateLimiter());

  // ─── Static file serving MUST come BEFORE notFound ─────────
  // Photos live under uploads/{sessions|tags}/... and are served
  // directly to the browser (thumbnails, hyperlinks).
  app.use(
    "/uploads",
    express.static(path.resolve(process.cwd(), "uploads"), {
      maxAge: "1h",
      fallthrough: true,
    }),
  );

  // ─── All API routes (handheld is already registered inside appRouter) ──
  app.use("/api/v1", appRouter);

  // ─── Swagger UI ────────────────────────────────────────────
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // ─── 404 + error handlers LAST ─────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
