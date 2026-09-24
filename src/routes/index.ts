import { Router } from "express";
import alertsRouter from "./alerts.routes.js";
import assetTransferRouter from "./asset-transfer.routes.js";
import auditRouter from "./audit.routes.js";
import { authRouter } from "./auth.routes.js";
import baselineRouter from "./baseline.routes.js";
import binningRouter from "./binning.routes.js";
import countCheckRouter from "./count-check.routes.js";
import devicesRouter from "./devices.routes.js";
import gateVerifyRoutes from "./gate-verify.routes.js";
import handheldRoutes from "./handheld.routes.js";
import { healthRouter } from "./health.routes.js";
import holdingRouter from "./holding.routes.js";
import ifsRouter from "./ifs.routes.js";
import lineCountRouter from "./line-count.routes.js"; // NEW
import masterDataRouter from "./master-data.routes.js";
import putAwayRouter from "./put-away.routes.js"; // NEW
import rbacRouter from "./rbac.routes.js";
import readerLookupRoutes from "./reader-lookup.routes.js";
import rrRouter from "./rr.routes.js";
import tagsRouter from "./tags.routes.js";
import transitDoorRouter from "./transit-door.routes.js";
import transitExitRouter from "./transit-exit.routes.js";
import transitRouter from "./transit.routes.js";
import userRouter from "./user.routes.js";
import varianceRouter from "./variance.routes.js";

import stockVerificationRouter from "./stock-verification.routes.js"; // NEW

export const appRouter = Router();
appRouter.use(healthRouter);
appRouter.use("/auth", authRouter);
appRouter.use("/rbac", rbacRouter);
appRouter.use("/users", userRouter);
appRouter.use("/audit", auditRouter);
appRouter.use("/rrs", rrRouter);
appRouter.use("/line-count", lineCountRouter); // NEW — counting before tag
appRouter.use("/tags", tagsRouter);
appRouter.use("/devices", devicesRouter);
appRouter.use("/alerts", alertsRouter);
appRouter.use("/master-data", masterDataRouter);
appRouter.use("/variances", varianceRouter);
appRouter.use("/baseline", baselineRouter);
appRouter.use("/transit", transitRouter);
appRouter.use("/transit-exit", transitExitRouter);
appRouter.use("/transit-door", transitDoorRouter);
appRouter.use("/binning", binningRouter);
appRouter.use("/holding", holdingRouter);
appRouter.use("/count-check", countCheckRouter);
appRouter.use("/put-away", putAwayRouter); // NEW
appRouter.use("/reader-lookup", readerLookupRoutes);
appRouter.use("/", gateVerifyRoutes);
appRouter.use("/handheld", handheldRoutes);
appRouter.use("/ifs", ifsRouter); // IFS Integration (fetch + polling)
appRouter.use("/ifs", stockVerificationRouter); // NEW — Phase 10 stock verification
appRouter.use(assetTransferRouter);
