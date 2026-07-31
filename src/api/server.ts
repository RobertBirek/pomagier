import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { getDb } from "../db/index.js";
import { logger } from "../lib/logger.js";
import { authMiddleware } from "./auth-middleware.js";
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
import { registerFieldMappingsRoutes } from "./routes/field-mappings.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerActivityRoutes } from "./routes/activity.js";
import { registerTerminalsRoutes } from "./routes/terminals.js";
import { registerCaRoutes } from "./routes/ca.js";
import { registerWizardRoutes } from "./routes/wizard.js";
import { errorHandler } from "./error-handler.js";

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
app.use(authMiddleware);
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://pomagier.ilovelighting.hmcloud.pl", "https://localhost"]
        : [
            "https://pomagier.ilovelighting.hmcloud.pl",
            "https://localhost",
            "http://localhost:5173",
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

// Auto-migrate on startup
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

const port = parseInt(process.env.API_PORT ?? "3001", 10);
app.listen(port, () => {
  logger.info({ port }, "API server started");
});
