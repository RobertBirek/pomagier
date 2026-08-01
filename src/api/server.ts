import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { getDb } from "../db/index.js";
import { logger, withCorrelation } from "../lib/logger.js";
import { authMiddleware, requireAuthByDefault } from "./auth-middleware.js";
import { registerBackupRoutes } from "./routes/backup.js";
import { registerLocationsRoutes } from "./routes/locations.js";
import { getEnv } from "../lib/env.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerUsersRoutes } from "./routes/users.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerScanRoutes } from "./routes/scan.js";
import { registerProductsRoutes } from "./routes/products.js";
import { registerErpConfigRoutes } from "./routes/erp-config.js";
import { registerErpIndexesRoutes } from "./routes/erp-indexes.js";
import { registerErpSupportedWarehousesRoutes } from "./routes/erp-supported-warehouses.js";
import { registerFieldMappingsRoutes } from "./routes/field-mappings.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerActivityRoutes } from "./routes/activity.js";
import { registerLogsRoutes } from "./routes/logs.js";
import { registerTerminalsRoutes } from "./routes/terminals.js";
import { registerCaRoutes } from "./routes/ca.js";
import { registerWizardRoutes } from "./routes/wizard.js";
import { startCleanupInterval, runCleanup } from "../lib/cleanup.js";
import { startSystemMonitor } from "../lib/system-monitor.js";
import { errorHandler } from "./error-handler.js";
import { logEvent } from "../lib/app-logger.js";

// Validate environment on startup (warn but don't crash — app can work with mock)
try {
  const env = getEnv();
  logger.info({ nodeEnv: env.NODE_ENV, port: env.API_PORT }, "Environment validated");
  if (env.JWT_SECRET.length < 16) {
    logger.warn("JWT_SECRET is shorter than recommended (min 16 chars)");
  }
  if (env.NODE_ENV === "production" && env.JWT_SECRET.includes("dev-")) {
    logger.warn("Production is using a development JWT_SECRET");
  }
} catch (err) {
  logger.warn({ err }, "Environment validation failed — some features may not work");
}

const app = express();
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        mediaSrc: ["'self'"],
      },
    },
  }),
);
app.use(cookieParser());
app.use((req, res, next) => withCorrelation(() => next()));
app.use(authMiddleware);
app.use(requireAuthByDefault); // Auth-by-default: all /api endpoints require session unless whitelisted
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://pomagier.ilovelighting.hmcloud.pl", "https://localhost"]
        : [
            "https://pomagier.ilovelighting.hmcloud.pl",
            "https://localhost",
            "http://localhost:5173",
            "http://localhost:4173",
          ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", 1);

const globalLimiter = rateLimit({
  windowMs: 60000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/api/health",
});
app.use("/api/login", rateLimit({ windowMs: 60000, max: 20 }));
app.use("/api/scan", globalLimiter);
app.use("/api/locations", globalLimiter);
app.get("/api/health", rateLimit({ windowMs: 60000, max: 300 }));
app.use("/api", globalLimiter);

// --- ERP Config + Test Connection routes ---
registerErpConfigRoutes(app);
registerErpIndexesRoutes(app);
registerErpSupportedWarehousesRoutes(app);

// --- Field Mappings routes ---
registerFieldMappingsRoutes(app);

// --- CA Certificate routes ---
registerCaRoutes(app);

// --- Wizard routes ---
registerWizardRoutes(app);

// --- Inventory routes ---
registerInventoryRoutes(app);

// --- Activity + Logs routes ---
registerActivityRoutes(app);
registerLogsRoutes(app);

// --- Terminals routes ---
registerTerminalsRoutes(app);

// --- Health + Company routes ---
registerHealthRoutes(app);

// --- Auth routes (login, PIN, role) ---
registerAuthRoutes(app);

// --- Users + Warehouses routes ---
registerUsersRoutes(app);

// --- Stats routes ---
registerStatsRoutes(app);

// --- Scan route ---
registerScanRoutes(app);

// --- Products routes ---
registerProductsRoutes(app);

// --- Location routes ---
registerLocationsRoutes(app);

// --- Backup & Restore ---
registerBackupRoutes(app);

// Global error handler (must be last middleware)
app.use(errorHandler);

// Migrations are opt-in in production; deploy scripts should run them after backup.
if (process.env.AUTO_MIGRATE === "true") {
  try {
    import("drizzle-orm/postgres-js/migrator")
      .then(async ({ migrate }) => {
        const db = getDb();
        await migrate(db, { migrationsFolder: "./src/db/migrations" });
        logger.info("Database migrations completed");
      })
      .catch((err) => {
        logger.warn({ err }, "Migration execution failed");
      });
  } catch (err) {
    logger.warn({ err }, "Migration skipped");
  }
} else {
  logger.info(
    "Automatic migrations disabled; use npm run db:migrate in a controlled deploy window",
  );
}

const port = parseInt(process.env.API_PORT ?? "3001", 10);
const server = app.listen(port, async () => {
  logger.info({ port }, "API server started");
  startCleanupInterval();
  logger.info("Cleanup interval started (30 days, runs daily)");
  startSystemMonitor();
  logger.info("System monitor started (every 5 min)");
  await logEvent({
    category: "system",
    action: "startup",
    method: "system",
    target: { type: "system", id: "api" },
    success: true,
    details: { port, nodeVersion: process.version, pid: process.pid },
  });
});
runCleanup().catch((err) => logger.error({ err }, "Initial cleanup failed"));

// Graceful shutdown: close MSSQL pool and HTTP server
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down...");
  server.close(() => logger.info("HTTP server closed"));
  try {
    const { getAdapter } = await import("./adapter-provider.js");
    const adapter = getAdapter();
    await adapter.close?.();
    logger.info("MSSQL pool closed");
  } catch {
    /* pool already closed */
  }
  await logEvent({
    category: "system",
    action: "shutdown",
    method: "system",
    target: { type: "system", id: "api" },
    success: true,
    details: { signal },
  });
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
