import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getAdapter } from "./adapter-provider.js";
import { getDb, schema } from "../db/index.js";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { authMiddleware, requireAdmin } from "./auth-middleware.js";
import { registerBackupRoutes } from "./routes/backup.js";
import { registerLocationsRoutes, getLocationField } from "./routes/locations.js";
import { getEnv } from "../lib/env.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerUsersRoutes } from "./routes/users.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerScanRoutes } from "./routes/scan.js";
import { registerProductsRoutes } from "./routes/products.js";
import { registerErpConfigRoutes } from "./routes/erp-config.js";
import { registerFieldMappingsRoutes } from "./routes/field-mappings.js";

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

// --- Pobierz root CA do instalacji na urządzeniach ---
app.get("/api/ca", async (_req, res) => {
  const fs = await import("node:fs");
  const caPath = process.env.MKCERT_CAROOT
    ? `${process.env.MKCERT_CAROOT}/rootCA.pem`
    : "/root/.local/share/mkcert/rootCA.pem";
  try {
    const cert = fs.readFileSync(caPath, "utf-8");
    res.setHeader("Content-Type", "application/x-pem-file");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=rootCA.${_req.query.format === "crt" ? "crt" : "pem"}`,
    );
    res.send(cert);
  } catch {
    res.status(404).json({ error: "CA cert not found" });
  }
});

// --- Aktywność: ostatnie ruchy, skany, wykres dzienny ---
app.get("/api/activity", async (_req, res) => {
  try {
    const db = getDb();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Last 20 movements
    const movements = await db
      .select()
      .from(schema.productMovements)
      .orderBy(sql`${schema.productMovements.createdAt} DESC`)
      .limit(20);

    // Last 20 scans (from audit log if used, fallback to movements)
    const scans = movements.slice(0, 10);

    // Daily chart: last 7 days
    const dailyStats: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      const [result] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(schema.productMovements)
        .where(
          sql`${schema.productMovements.createdAt} >= ${dayStart.toISOString()} AND ${schema.productMovements.createdAt} < ${dayEnd.toISOString()}`,
        );

      dailyStats.push({ date: d.toISOString().slice(0, 10), count: result?.count || 0 });
    }

    res.json({ movements, scans: scans.slice(0, 10), dailyStats });
  } catch (err) {
    logger.error({ err }, "Activity query failed");
    res.json({ movements: [], scans: [], dailyStats: [] });
  }
});

// --- Logi: historia ruchów + audyt ---
app.get("/api/logs", async (req, res) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(10, parseInt(req.query.pageSize as string) || 50));
    const offset = (page - 1) * pageSize;

    const movements = await db
      .select()
      .from(schema.productMovements)
      .orderBy(sql`${schema.productMovements.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset);
    const [movCount] = await db
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(schema.productMovements);

    const audits = await db
      .select()
      .from(schema.auditLog)
      .orderBy(sql`${schema.auditLog.createdAt} DESC`)
      .limit(pageSize);
    const [audCount] = await db.select({ cnt: sql<number>`COUNT(*)::int` }).from(schema.auditLog);

    const rows = [
      ...movements.map((m) => ({
        id: m.id,
        type: "movement",
        productId: m.productId,
        symbol: m.symbol,
        name: m.name,
        fromCode: m.fromCode,
        toCode: m.toCode,
        quantity: m.quantity,
        operator: m.operator,
        correlationId: m.correlationId,
        createdAt: m.createdAt,
      })),
      ...audits.map((a) => ({
        id: a.id,
        type: "audit",
        action: a.action,
        details: a.details,
        correlationId: a.correlationId,
        userId: a.userId,
        createdAt: a.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, pageSize);

    res.json({ rows, total: (movCount?.cnt || 0) + (audCount?.cnt || 0), page, pageSize });
  } catch (err) {
    logger.error({ err }, "Logs failed");
    res.json({ rows: [], total: 0, page: 1, pageSize: 50 });
  }
});

// === Wizard wdrożeniowy ===

// Status: czy system jest skonfigurowany?
app.get("/api/wizard/status", async (_req, res) => {
  try {
    const db = getDb();
    const [mssqlConfig] = await db
      .select()
      .from(schema.config)
      .where(eq(schema.config.key, "mssql_host"));
    const configured = !!mssqlConfig?.value;
    res.json({
      configured,
      hasEnv: !!process.env.MSSQL_HOST && process.env.MSSQL_HOST !== "{{MSSQL_HOST}}",
    });
  } catch {
    res.json({ configured: false, hasEnv: false });
  }
});

// Wyczyść tabele
app.post("/api/wizard/clear", requireAdmin, async (req, res) => {
  const { tables } = req.body ?? {};
  if (!Array.isArray(tables)) {
    res.status(400).json({ error: "Brak listy tabel" });
    return;
  }
  try {
    const db = getDb();
    if (tables.includes("locations")) await db.delete(schema.locations);
    if (tables.includes("product_locations")) await db.delete(schema.productLocations);
    if (tables.includes("product_movements")) await db.delete(schema.productMovements);
    if (tables.includes("users")) await db.delete(schema.users);
    res.json({ ok: true, cleared: tables });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Import wszystkiego
app.post("/api/wizard/import-all", requireAdmin, async (_req, res) => {
  const results: any = {};
  try {
    // Step 1: Import locations
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) {
      res.status(503).json({ error: "MSSQL niedostępny" });
      return;
    }

    const locationField = await getLocationField();
    const db = getDb();

    // Import locations
    const locResult = await pool
      .request()
      .query(
        `SELECT NULLIF(${locationField}, '') AS location FROM tw__Towar WHERE ${locationField} IS NOT NULL AND ${locationField} != '' GROUP BY ${locationField}`,
      );
    const { parseLocation } = await import("../lib/locations.js");
    let imported = 0,
      skipped = 0;
    for (const row of locResult.recordset) {
      const parts = ((row as any).location as string)
        .split(/[,;]/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      for (const part of parts) {
        const parsed = parseLocation(part);
        if (!parsed) {
          skipped++;
          continue;
        }
        try {
          await db
            .insert(schema.locations)
            .values({
              code: parsed.raw,
              area: parsed.area,
              aisle: parsed.aisle,
              rack: parsed.rack,
              shelf: parsed.shelf,
              spot: parsed.spot,
              label: parsed.label,
            })
            .onConflictDoNothing();
          imported++;
        } catch {
          skipped++;
        }
      }
    }
    results.locations = { imported, skipped };

    // Step 2: Sync product locations
    await db.delete(schema.productLocations);
    let plInserted = 0,
      plSkipped = 0;
    const allLocs = await db.select().from(schema.locations);
    const allProducts = await pool
      .request()
      .query(
        `SELECT tw_Id AS productId, NULLIF(${locationField}, '') AS locRaw FROM tw__Towar WHERE ${locationField} IS NOT NULL AND ${locationField} != ''`,
      );
    for (const row of allProducts.recordset) {
      const productId = (row as any).productId;
      const parts = ((row as any).locRaw as string)
        .split(/[,;]/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      for (const part of parts) {
        const parsed = parseLocation(part);
        if (!parsed) {
          plSkipped++;
          continue;
        }
        const loc = allLocs.find((l) => l.code === parsed.raw);
        if (!loc) {
          plSkipped++;
          continue;
        }
        try {
          await db
            .insert(schema.productLocations)
            .values({ productId, locationId: loc.id, quantity: 1 })
            .onConflictDoNothing();
          plInserted++;
        } catch {
          plSkipped++;
        }
      }
    }
    results.productLocations = { inserted: plInserted, skipped: plSkipped };

    // Step 3: Seed users
    const userResult = await pool
      .request()
      .query("SELECT uz_Id AS id FROM pd_Uzytkownik WHERE uz_Status = 1");
    let usersSeeded = 0;
    const crypto = await import("node:crypto");
    for (const row of userResult.recordset) {
      const subiektUzId = (row as any).id;
      await db
        .insert(schema.users)
        .values({
          subiektUzId,
          pin: bcrypt.hashSync("0000", 10),
          role: subiektUzId === 1 ? "admin" : "operator",
        })
        .onConflictDoNothing();
      usersSeeded++;
    }
    results.users = { seeded: usersSeeded };

    res.json({ ok: true, results });
  } catch (err) {
    logger.error({ err }, "Import all failed");
    res.status(500).json({ error: "Import nie powiódł się" });
  }
});

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

// --- Raport inwentaryzacji ---
app.post("/api/inventory/report", requireAdmin, async (req, res) => {
  const { scope, area, aisle, rack, shelf, scanned } = req.body ?? {};
  if (!Array.isArray(scanned)) {
    res.status(400).json({ error: "Brak zeskanowanych" });
    return;
  }
  try {
    const expectedRes = await fetch(
      `http://localhost:3000/api/inventory/expected?scope=${scope}&area=${area}&aisle=${aisle}&rack=${rack}&shelf=${shelf}`,
    );
    const expectedData = await expectedRes.json();
    const ep: any[] = expectedData.products || [];
    const sm = new Map();
    for (const s of scanned) sm.set(s.code, (sm.get(s.code) || 0) + s.qty);
    const matched = [],
      missing = [],
      extra = [],
      qDiff = [];
    const sc = new Set(sm.keys());
    for (const p of ep) {
      const sq = sm.get(p.barcode) || sm.get(p.symbol) || 0;
      if (sq === 0) missing.push(p);
      else if (sq !== p.qty) qDiff.push({ ...p, expectedQty: p.qty, scannedQty: sq });
      else matched.push(p);
      if (p.barcode) sc.delete(p.barcode);
      sc.delete(p.symbol);
    }
    for (const c of sc) extra.push({ code: c, qty: sm.get(c) || 0 });
    try {
      const db = getDb();
      await db.insert(schema.auditLog).values({
        correlationId: crypto.randomUUID(),
        action: "inventory_report",
        details: JSON.stringify({ scope, matched: matched.length, missing: missing.length }),
      });
    } catch {}
    res.json({
      summary: {
        expected: ep.length,
        scanned: scanned.length,
        matched: matched.length,
        missing: missing.length,
        extra: extra.length,
        quantityDiff: qDiff.length,
      },
      matched,
      missing,
      extra,
      quantityDiff: qDiff,
    });
  } catch (err) {
    logger.error({ err }, "Report failed");
    res.status(500).json({ error: "Blad" });
  }
});

app.get("/api/terminals", requireAdmin, async (_req, res) => {
  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    const now = new Date();
    const rows = await db
      .select()
      .from(schema.sessions)
      .orderBy(sql`created_at DESC`)
      .limit(20);

    const terminals = rows.filter((s) => new Date(s.expiresAt) > now);

    // Fetch user names from Subiekt
    const userNameMap = new Map<string, string>();
    if (pool) {
      const userIds = [...new Set(terminals.map((t) => t.userId))];
      const userRows = await db
        .select()
        .from(schema.users)
        .where(
          sql`${schema.users.id} IN (${userIds.map(() => sql`?`).reduce((arr, p) => [...arr, p], [] as any)})`,
        );
      const subiektIds = userRows.map((u) => u.subiektUzId);

      if (subiektIds.length > 0) {
        const names = await pool.request().query(`
          SELECT uz_Id AS id, uz_Imie AS firstName, uz_Nazwisko AS lastName
          FROM pd_Uzytkownik
          WHERE uz_Id IN (${subiektIds.join(",")})
        `);
        for (const row of names.recordset) {
          const r = row as { id: number; firstName: string; lastName: string };
          const subiektId = r.id;
          const appUser = userRows.find((u) => u.subiektUzId === subiektId);
          if (appUser) {
            userNameMap.set(appUser.id, `${r.firstName || ""} ${r.lastName || ""}`.trim());
          }
        }
      }
    }

    res.json(
      terminals.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: userNameMap.get(s.userId) || "",
        loginTime: s.createdAt,
        expiresAt: s.expiresAt,
      })),
    );
  } catch {
    res.json([]);
  }
});

app.get("/ca", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(
    `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"/><title>Pobierz certyfikat</title></head><body style="font-family:system-ui;padding:20px;text-align:center"><h2>Certyfikat PomagierGT</h2><p>Kliknij przycisk aby pobrać i zainstalować:</p><a href="/api/ca" download="rootCA.crt" style="display:inline-block;background:#1e40af;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;touch-action:manipulation">📥 Pobierz rootCA.crt</a><p style="margin-top:20px;color:#666;font-size:14px">Po pobraniu: Ustawienia → Bezpieczeństwo → Zainstaluj certyfikat</p></body></html>`,
  );
});

const port = parseInt(process.env.API_PORT ?? "3001", 10);
app.listen(port, () => {
  // === Inwentaryzacja ===
  app.get("/api/inventory/expected", async (req, res) => {
    const scope = (req.query.scope as string) || "exact";
    const area = (req.query.area as string) || "A";
    const aisle = parseInt(req.query.aisle as string) || 0;
    const rack = parseInt(req.query.rack as string) || 0;
    const shelf = parseInt(req.query.shelf as string) || 0;
    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      let q = db
        .select({
          code: schema.locations.code,
          area: schema.locations.area,
          aisle: schema.locations.aisle,
          rack: schema.locations.rack,
          shelf: schema.locations.shelf,
          productId: schema.productLocations.productId,
          quantity: schema.productLocations.quantity,
        })
        .from(schema.productLocations)
        .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id))
        .where(eq(schema.locations.area, area));
      if (["exact", "shelf", "rack"].includes(scope) && aisle)
        q = (q as any).where(eq(schema.locations.aisle, aisle));
      if (["exact", "shelf"].includes(scope) && rack)
        q = (q as any).where(eq(schema.locations.rack, rack));
      if (["exact"].includes(scope) && shelf)
        q = (q as any).where(eq(schema.locations.shelf, shelf));
      const rows = await q;
      const grouped = new Map();
      for (const r of rows) {
        if (!r.productId) continue;
        const g = grouped.get(r.productId) || {
          id: r.productId,
          symbol: "",
          name: "",
          unit: "",
          barcode: "",
          locations: [],
          qty: 0,
          subiektStock: 0,
        };
        g.locations.push(r.code);
        g.qty += r.quantity || 0;
        grouped.set(r.productId, g);
      }
      if (pool && grouped.size > 0) {
        const ids = [...grouped.keys()];
        const pr = await pool
          .request()
          .query(
            `SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name, tw_JednMiary AS unit, tw_PodstKodKresk AS barcode FROM tw__Towar WHERE tw_Id IN (${ids})`,
          );
        for (const p of pr.recordset) {
          const g = grouped.get((p as any).id);
          if (g) {
            g.symbol = (p as any).symbol;
            g.name = (p as any).name;
            g.unit = (p as any).unit;
            g.barcode = (p as any).barcode;
          }
        }
        const sr = await pool
          .request()
          .query(
            `SELECT st_TowId, SUM(st_Stan) AS total FROM tw_Stan WHERE st_TowId IN (${ids}) GROUP BY st_TowId`,
          );
        for (const s of sr.recordset) {
          const g = grouped.get((s as any).st_TowId);
          if (g) g.subiektStock = (s as any).total;
        }
      }
      res.json({ scope, area, aisle, rack, shelf, products: [...grouped.values()] });
    } catch (err) {
      logger.error({ err }, "Inventory expected failed");
      res.json({ products: [] });
    }
  });

  logger.info({ port }, "API server started");
});
