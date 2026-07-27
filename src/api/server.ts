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
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { authMiddleware, requireAdmin } from "./auth-middleware.js";
import { registerBackupRoutes } from "./routes/backup.js";
import { registerLocationsRoutes, getLocationField } from "./routes/locations.js";

const app = express();
app.use(helmet());
app.use(cookieParser());
app.use(authMiddleware);
app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? ["https://pomagier.local", "https://localhost"]
      : ["https://pomagier.local", "https://localhost", "http://localhost:5173"],
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

// --- Auth helpers ---
function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

function verifyPin(pin: string, hash: string): boolean {
  return bcrypt.compareSync(pin, hash);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// --- Health ---
app.get("/api/health", async (_req, res) => {
  const adapter = getAdapter();
  const erpHealth = await adapter.healthCheck();
  res.json({ status: "ok", timestamp: new Date().toISOString(), erp: erpHealth });
});

// --- Company info (z Subiekta) ---
app.get("/api/company", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) {
      return res.json({ name: "PomagierGT (no pool)", nip: "", regon: "" });
    }
    const result = await pool.request().query(`
      SELECT TOP 1
        adr_NazwaPelna AS name,
        adr_Nazwa AS shortName,
        adr_NIP AS nip,
        CAST(pd_Regon AS varchar) AS regon,
        adr_Ulica AS street,
        adr_NrDomu AS houseNo,
        adr_NrLokalu AS aptNo,
        adr_Kod AS postalCode,
        adr_Miejscowosc AS city,
        adr_Telefon AS phone,
        pd_WWW AS www,
        pd_Email AS email,
        NazwaBanku AS bankName,
        NumerRachunku AS bankAccount
      FROM vwFeniksFirmaSync
    `);
    const row = result.recordset[0];
    res.json({
      name: row?.name || row?.shortName || "Podmiot",
      shortName: row?.shortName || "",
      nip: row?.nip || "",
      regon: row?.regon || "",
      street: row?.street
        ? `${row.street} ${row.houseNo || ""}${row.aptNo ? `/${row.aptNo}` : ""}`
        : "",
      postalCode: row?.postalCode || "",
      city: row?.city || "",
      phone: row?.phone || "",
      www: row?.www || "",
      email: row?.email || "",
      bankName: row?.bankName || "",
      bankAccount: row?.bankAccount || "",
    });
  } catch (err) {
    logger.error({ err }, "Company query failed");
    res.json({ name: "PomagierGT (demo)", nip: "", regon: "" });
  }
});

// --- Użytkownicy (Subiekt + PIN z Postgres) ---
app.get("/api/users", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.json([]);

    const result = await pool.request().query(`
      SELECT uz_Id AS id, uz_Imie AS firstName, uz_Nazwisko AS lastName, uz_Status AS active
      FROM pd_Uzytkownik
      ORDER BY uz_Id
    `);

    const db = getDb();
    const appUsers = await db.select().from(schema.users);

    const users = result.recordset.map((u: any) => {
      const appUser = appUsers.find((a) => a.subiektUzId === u.id);
      return {
        subiektId: u.id,
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        active: u.active === true || u.active === 1,
        hasPin: !!appUser,
        role: appUser?.role || "operator",
      };
    });

    res.json(users);
  } catch (err) {
    logger.error({ err }, "Failed to fetch users");
    res.json([]);
  }
});

// --- Magazyny (z Subiekta) ---
app.get("/api/warehouses", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.json([]);

    const result = await pool.request().query(`
      SELECT mag_Id AS id, mag_Symbol AS symbol, mag_Nazwa AS name, mag_Glowny AS isMain
      FROM sl_Magazyn
      ORDER BY mag_Id
    `);
    res.json(result.recordset);
  } catch {
    res.json([]);
  }
});

// --- Logowanie ---
app.post("/api/login", async (req, res) => {
  const { subiektUzId, pin } = req.body ?? {};

  if (!subiektUzId || !pin) {
    res.status(400).json({ error: "Brak ID użytkownika lub PIN" });
    return;
  }

  try {
    const db = getDb();
    const [user] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.subiektUzId, subiektUzId), eq(schema.users.active, true)));

    if (!user) {
      try {
        await db
          .insert(schema.auditLog)
          .values({
            correlationId: crypto.randomUUID(),
            action: "login_failed",
            details: JSON.stringify({ subiektUzId, reason: "no_user" }),
          });
      } catch {}
      res.status(401).json({ error: "Użytkownik nie skonfigurowany w PomagierGT" });
      return;
    }

    if (!verifyPin(pin, user.pin)) {
      try {
        await db
          .insert(schema.auditLog)
          .values({
            correlationId: crypto.randomUUID(),
            userId: user.id,
            action: "login_failed",
            details: JSON.stringify({ subiektUzId, reason: "wrong_pin" }),
          });
      } catch {}
      res.status(401).json({ error: "Nieprawidłowy PIN" });
      return;
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db.insert(schema.sessions).values({
      userId: user.id,
      token,
      expiresAt,
    });

    await db.insert(schema.auditLog).values({
      correlationId: crypto.randomUUID(),
      userId: user.id,
      action: "login",
      details: JSON.stringify({ subiektUzId, timestamp: new Date().toISOString() }),
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000,
      path: "/",
    });

    res.json({ token, user: { id: user.id, subiektUzId: user.subiektUzId, role: user.role } });
  } catch (err) {
    logger.error({ err }, "Login failed");
    res.status(500).json({ error: "Błąd logowania" });
  }
});

// --- Skanowanie ---
app.post("/api/scan", async (req, res) => {
  const { code } = req.body ?? {};

  if (!code || typeof code !== "string" || code.length > 50) {
    res
      .status(422)
      .json({ error: "Invalid code", found: false, barcode: code ?? "", products: [] });
    return;
  }

  try {
    const adapter = getAdapter();
    const result = await adapter.scan(code.trim());
    logger.info({ code, found: result.found }, "Scan completed");
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ERP error";
    logger.error({ err, code }, "Scan failed");
    res.status(502).json({ error: message, found: false, barcode: code, products: [] });
  }
});

// --- KPI dla admina ---
app.get("/api/stats", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.json({ products: 0, warehouses: 0, users: 0 });
    const [p, w, u] = await Promise.all([
      pool.request().query("SELECT COUNT(*) AS cnt FROM tw__Towar"),
      pool.request().query("SELECT COUNT(*) AS cnt FROM sl_Magazyn"),
      pool.request().query("SELECT COUNT(*) AS cnt FROM pd_Uzytkownik WHERE uz_Status = 1"),
    ]);
    res.json({
      products: p.recordset[0].cnt,
      warehouses: w.recordset[0].cnt,
      users: u.recordset[0].cnt,
    });
  } catch {
    res.json({ products: 0, warehouses: 0, users: 0 });
  }
});

// --- Test MSSQL connection with given params ---
app.post("/api/test-connection", requireAdmin, async (req, res) => {
  const { host, port, database, user, password } = req.body ?? {};
  if (!host || !database || !user || !password) {
    res
      .status(400)
      .json({ ok: false, error: "Brak wymaganych parametrów (host, database, user, password)" });
    return;
  }
  try {
    const { MssqlErpAdapter } = await import("../erp/mssql.adapter.js");
    const testAdapter = new MssqlErpAdapter();
    await testAdapter.reconnect({ host, port: parseInt(port) || 1433, database, user, password });
    const health = await testAdapter.healthCheck();
    res.json(health);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({ ok: false, error: message });
  }
});

// --- Get ERP config (from Postgres, fallback to env) ---
app.get("/api/erp-config", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.select().from(schema.config);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({
      host: map.mssql_host || process.env.MSSQL_HOST || "",
      port: parseInt(map.mssql_port) || parseInt(process.env.MSSQL_PORT || "1433"),
      database: map.mssql_database || process.env.MSSQL_DATABASE || "",
      user: map.mssql_user || process.env.MSSQL_USER || "",
      password: "••••••••",
    });
  } catch {
    res.json({
      host: process.env.MSSQL_HOST || "",
      port: parseInt(process.env.MSSQL_PORT || "1433"),
      database: process.env.MSSQL_DATABASE || "",
      user: process.env.MSSQL_USER || "",
      password: "••••••••",
    });
  }
});

// --- Save ERP config ---
app.post("/api/erp-config", async (req, res) => {
  const { host, port, database, user, password } = req.body ?? {};
  if (!host || !database || !user) {
    res.status(400).json({ error: "Brak wymaganych parametrów" });
    return;
  }
  try {
    const db = getDb();
    const entries = [
      { key: "mssql_host", value: host },
      { key: "mssql_port", value: String(port || 1433) },
      { key: "mssql_database", value: database },
      { key: "mssql_user", value: user },
    ];
    if (password && password !== "••••••••") {
      entries.push({ key: "mssql_password", value: password });
    }
    for (const e of entries) {
      await db
        .insert(schema.config)
        .values({ key: e.key, value: e.value })
        .onConflictDoUpdate({ target: schema.config.key, set: { value: e.value } });
    }

    // Reconnect adapter with new config
    const adapter = getAdapter();
    const storedPwd =
      password && password !== "••••••••"
        ? password
        : (await db.select().from(schema.config).where(eq(schema.config.key, "mssql_password")))[0]
            ?.value ||
          process.env.MSSQL_PASSWORD ||
          "";
    await adapter.reconnect?.({
      host,
      port: parseInt(String(port)) || 1433,
      database,
      user,
      password: storedPwd,
    });

    logger.info("ERP config saved and reconnected");
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Failed to save ERP config");
    res.status(500).json({ error: message });
  }
});

// --- Lista towarów (paginacja, wyszukiwanie, filtrowanie) ---
app.get("/api/products", async (req, res) => {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.json({ rows: [], total: 0, page: 1, pageSize: 50 });

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(200, Math.max(5, parseInt(req.query.pageSize as string) || 50));
    const search = ((req.query.search as string) || "").trim();
    const warehouseId = parseInt(req.query.warehouseId as string) || 0;
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    const params: { name: string; value: any }[] = [];

    if (search) {
      whereClause +=
        " AND (t.tw_Symbol LIKE @search OR t.tw_Nazwa LIKE @search OR t.tw_PodstKodKresk LIKE @search)";
      params.push({ name: "search", value: `%${search}%` });
    }

    const countQuery = `SELECT COUNT(*) AS total FROM tw__Towar t ${whereClause}`;
    const dataQuery = `
      SELECT
        t.tw_Id AS id, t.tw_Symbol AS symbol, t.tw_Nazwa AS name,
        t.tw_PodstKodKresk AS barcode, t.tw_JednMiary AS unit,
        t.tw_Opis AS description,
        ISNULL((SELECT SUM(st_Stan) FROM tw_Stan WHERE st_TowId = t.tw_Id), 0) AS stock,
        ISNULL((SELECT SUM(st_StanRez) FROM tw_Stan WHERE st_TowId = t.tw_Id), 0) AS reserved
      FROM tw__Towar t
      ${whereClause}
      ORDER BY t.tw_Symbol
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `;

    const countReq = pool.request();
    for (const p of params) {
      countReq.input(p.name, p.value);
    }
    const countResult = await countReq.query(countQuery);
    const total = (countResult.recordset[0] as any).total;

    const dataReq = pool.request();
    for (const p of params) {
      dataReq.input(p.name, p.value);
    }
    dataReq.input("offset", offset);
    dataReq.input("pageSize", pageSize);
    if (warehouseId) dataReq.input("wh", warehouseId);

    const dataResult = await dataReq.query(dataQuery);
    let rows: any[] = [...dataResult.recordset];
    try {
      const db = getDb();
      const productIds = rows.map((r: any) => r.id);
      if (productIds.length > 0) {
        const plRows = await db
          .select({ productId: schema.productLocations.productId, code: schema.locations.code })
          .from(schema.productLocations)
          .leftJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id));
        //.where(inArray(schema.productLocations.productId, productIds));

        const locMap = new Map<number, string[]>();
        for (const pl of plRows) {
          if (pl.productId && pl.code) {
            const list = locMap.get(pl.productId) || [];
            list.push(pl.code);
            locMap.set(pl.productId, list);
          }
        }
        rows = rows.map((r: any) => ({
          ...r,
          locations: locMap.get(r.id) || [],
        }));
      }
    } catch {
      // Postgres might be down
      rows = rows.map((r: any) => ({ ...r, locations: [] }));
    }

    res.json({
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    logger.error({ err }, "Products query failed");
    res.json({ rows: [], total: 0, page: 1, pageSize: 50, totalPages: 0 });
  }
});

// --- Mapowanie pól Pomagier ↔ Subiekt GT ---
app.get("/api/field-mappings", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.config)
      .where(sql`${schema.config.key} LIKE 'fieldmap_%'`);
    const { DEFAULT_MAPPINGS } = await import("../lib/field-mappings.js");

    const map = new Map(rows.map((r) => [r.key.replace("fieldmap_", ""), r.value]));
    const result = DEFAULT_MAPPINGS.map((dm) => ({
      ...dm,
      subiektField: map.get(dm.key) || dm.subiektField,
    }));
    res.json(result);
  } catch {
    const { DEFAULT_MAPPINGS } = await import("../lib/field-mappings.js");
    res.json(DEFAULT_MAPPINGS);
  }
});

app.put("/api/field-mappings", requireAdmin, async (req, res) => {
  const mappings = req.body as { key: string; subiektField: string }[];
  if (!Array.isArray(mappings)) {
    res.status(400).json({ error: "Oczekiwano tablicy" });
    return;
  }
  try {
    const db = getDb();
    for (const m of mappings) {
      await db
        .insert(schema.config)
        .values({ key: `fieldmap_${m.key}`, value: m.subiektField })
        .onConflictDoUpdate({ target: schema.config.key, set: { value: m.subiektField } });
    }
    logger.info({ count: mappings.length }, "Field mappings saved");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to save field mappings");
    res.status(500).json({ error: "Błąd zapisu" });
  }
});

// --- Zmiana PIN użytkownika ---
app.put("/api/users/:subiektId/pin", async (req, res) => {
  const subiektUzId = parseInt(req.params.subiektId as string);
  const { pin } = req.body ?? {};

  // Allow self-change or admin override
  if (!req.user) { res.status(401).json({ error: "Zaloguj się" }); return; }
  if (req.user.role !== "admin" && req.user.subiektUzId !== subiektUzId) {
    res.status(403).json({ error: "Możesz zmienić tylko swój PIN" }); return;
  }

  if (!pin || pin.length < 4 || pin.length > 8) {
    res.status(400).json({ error: "PIN musi mieć 4-8 cyfr" });
    return;
  }
  if (!/^\d+$/.test(pin)) {
    res.status(400).json({ error: "PIN może zawierać tylko cyfry" });
    return;
  }

  try {
    const db = getDb();
    await db
      .insert(schema.users)
      .values({ subiektUzId, pin: hashPin(pin), role: "operator" })
      .onConflictDoUpdate({ target: schema.users.subiektUzId, set: { pin: hashPin(pin) } });

    logger.info({ subiektUzId }, "PIN updated");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PIN update failed");
    res.status(500).json({ error: "Błąd zapisu" });
  }
});

// --- Zmiana roli użytkownika ---
app.put("/api/users/:subiektId/role", requireAdmin, async (req, res) => {
  const subiektUzId = parseInt(req.params.subiektId as string);
  const { role } = req.body ?? {};
  if (!subiektUzId || !["admin", "operator"].includes(role)) { res.status(400).json({ error: "Nieprawidłowa rola" }); return; }
  try {
    const db = getDb();
    if (role !== "admin") {
      const admins = await db.select().from(schema.users).where(and(eq(schema.users.role, "admin"), eq(schema.users.active, true)));
      if (admins.length === 1 && admins[0].subiektUzId === subiektUzId) { res.status(400).json({ error: "Nie można usunąć ostatniego administratora" }); return; }
    }
    await db.update(schema.users).set({ role }).where(eq(schema.users.subiektUzId, subiektUzId));
    logger.info({ subiektUzId, role }, "User role updated");
    res.json({ ok: true, role });
  } catch (err) { logger.error({ err }, "Role update failed"); res.status(500).json({ error: "Błąd" }); }
});

// --- Losowy kod towaru z Subiekta ---
app.get("/api/products/random", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.json({ code: "5901234567890", name: "Demo" });

    const result = await pool.request().query(`
      SELECT TOP 1 tw_Symbol AS code, tw_Nazwa AS name
      FROM tw__Towar
      WHERE tw_PodstKodKresk IS NOT NULL AND tw_PodstKodKresk != ''
      ORDER BY NEWID()
    `);
    const row = result.recordset[0];
    res.json(row ? { code: row.code, name: row.name } : { code: "5901234567890", name: "Demo" });
  } catch {
    res.json({ code: "5901234567890", name: "Demo" });
  }
});

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

// --- Szybkie wyszukiwanie towarów (do auto-complete) ---
app.get("/api/products/quick-search", async (req, res) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q || q.length < 2) {
    res.json([]);
    return;
  }

  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.json([]);

    const result = await pool.request().input("q", `%${q}%`).query(`
      SELECT TOP 8 tw_Symbol AS code, tw_Nazwa AS name, tw_PodstKodKresk AS barcode
      FROM tw__Towar
      WHERE tw_Symbol LIKE @q OR tw_Nazwa LIKE @q OR tw_PodstKodKresk LIKE @q
      ORDER BY CASE WHEN tw_Symbol LIKE @q+'%' THEN 0 ELSE 1 END, tw_Symbol
    `);
    res.json(result.recordset);
  } catch {
    res.json([]);
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
        .split(";")
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
        .split(";")
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
          pin: hashPin("0000"),
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

// --- Location routes ---
registerLocationsRoutes(app);

// --- Backup & Restore ---
registerBackupRoutes(app);

// Auto-migrate on startup
try {
  import("drizzle-orm/postgres-js/migrator").then(async ({ migrate }) => {
    const db = getDb();
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    logger.info("Database migrations completed");
  }).catch((err) => {
    logger.warn({ err }, "Migration execution failed");
  });
} catch (err) {
  logger.warn({ err }, "Migration skipped");
}


// --- Pełne dane produktu ---
app.get("/api/products/:id", async (req, res) => {
  const productId = parseInt(req.params.id as string);
  if (!productId) { res.status(400).json({ error: "Brak ID" }); return; }
  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });

    const result = await pool.request().input("id", productId).query(`
      SELECT tw_Id, tw_Symbol, tw_Nazwa, tw_Opis, tw_PodstKodKresk, tw_JednMiary,
             tw_PKWiU, tw_KodTowaru, tw_StanMin, tw_JednStanMin, tw_StanMaks, tw_DniWaznosc,
             tw_Masa, tw_MasaNetto, tw_CenaOtwarta, tw_ObjetySysKaucyjnym, tw_Zablokowany,
             tw_Pole1, tw_Pole2, tw_Pole3, tw_IdGrupa, tw_IdVatSp, tw_UrzNazwa
      FROM tw__Towar WHERE tw_Id = @id
    `);
    if (!result.recordset[0]) { res.status(404).json({ error: "Nie znaleziono" }); return; }
    const row = result.recordset[0] as any;

    // Stock per warehouse
    const stockRows = await pool.request().input("id", productId).query(`
      SELECT s.st_MagId, m.mag_Symbol, m.mag_Nazwa, s.st_Stan, s.st_StanRez, s.st_StanMin, s.st_StanMax
      FROM tw_Stan s JOIN sl_Magazyn m ON m.mag_Id = s.st_MagId WHERE s.st_TowId = @id
    `);

    // Locations from Postgres
    const plRows = await db.select({ code: schema.locations.code, area: schema.locations.area, aisle: schema.locations.aisle, rack: schema.locations.rack, shelf: schema.locations.shelf })
      .from(schema.productLocations).innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id))
      .where(eq(schema.productLocations.productId, productId));

    // Movement history
    const movements = await db.select().from(schema.productMovements).where(eq(schema.productMovements.productId, productId)).orderBy(sql`${schema.productMovements.createdAt} DESC`).limit(10);

    // VAT rate lookup
    let vatRate = "";
    if (row.tw_IdVatSp) {
      const vatRow = await pool.request().input("id", row.tw_IdVatSp).query("SELECT vat_Nazwa FROM sl_StawkaVAT WHERE vat_Id = @id");
      if (vatRow.recordset[0]) vatRate = (vatRow.recordset[0] as any).vat_Nazwa;
    }

    // Group name
    let groupName = "";
    if (row.tw_IdGrupa) {
      const grRow = await pool.request().input("id", row.tw_IdGrupa).query("SELECT grt_Nazwa FROM sl_GrupaTw WHERE grt_Id = @id");
      if (grRow.recordset[0]) groupName = (grRow.recordset[0] as any).grt_Nazwa;
    }

    res.json({
      id: row.tw_Id, symbol: row.tw_Symbol, name: row.tw_Nazwa, description: row.tw_Opis,
      barcode: row.tw_PodstKodKresk, unit: row.tw_JednMiary, pkwiu: row.tw_PKWiU,
      productCode: row.tw_KodTowaru, minStock: row.tw_StanMin, minStockUnit: row.tw_JednStanMin,
      maxStock: row.tw_StanMaks, expiryDays: row.tw_DniWaznosc, weight: row.tw_Masa,
      netWeight: row.tw_MasaNetto, openPrice: row.tw_CenaOtwarta, depositSystem: row.tw_ObjetySysKaucyjnym,
      blocked: row.tw_Zablokowany, vatRate, groupName, producerCode: row.tw_UrzNazwa,
      stocks: stockRows.recordset, locations: plRows, movements,
    });
  } catch (err) { logger.error({ err }, "Product detail failed"); res.status(500).json({ error: "Błąd" }); }
});


// --- Raport inwentaryzacji ---
app.post("/api/inventory/report", requireAdmin, async (req, res) => {
  const { scope, area, aisle, rack, shelf, scanned } = req.body ?? {};
  if (!Array.isArray(scanned)) { res.status(400).json({ error: "Brak zeskanowanych" }); return; }
  try {
    const expectedRes = await fetch(`http://localhost:3000/api/inventory/expected?scope=${scope}&area=${area}&aisle=${aisle}&rack=${rack}&shelf=${shelf}`);
    const expectedData = await expectedRes.json();
    const ep: any[] = expectedData.products || [];
    const sm = new Map(); for (const s of scanned) sm.set(s.code, (sm.get(s.code) || 0) + s.qty);
    const matched = [], missing = [], extra = [], qDiff = [];
    const sc = new Set(sm.keys());
    for (const p of ep) { const sq = sm.get(p.barcode) || sm.get(p.symbol) || 0; if (sq === 0) missing.push(p); else if (sq !== p.qty) qDiff.push({ ...p, expectedQty: p.qty, scannedQty: sq }); else matched.push(p); if (p.barcode) sc.delete(p.barcode); sc.delete(p.symbol); }
    for (const c of sc) extra.push({ code: c, qty: sm.get(c) || 0 });
    try { const db = getDb(); await db.insert(schema.auditLog).values({ correlationId: crypto.randomUUID(), action: "inventory_report", details: JSON.stringify({ scope, matched: matched.length, missing: missing.length }) }); } catch {}
    res.json({ summary: { expected: ep.length, scanned: scanned.length, matched: matched.length, missing: missing.length, extra: extra.length, quantityDiff: qDiff.length }, matched, missing, extra, quantityDiff: qDiff });
  } catch (err) { logger.error({ err }, "Report failed"); res.status(500).json({ error: "Blad" }); }
});

// --- Aktywne terminale ---
app.get("/api/terminals", requireAdmin, async (_req, res) => {
  try {
    const db = getDb(); const now = new Date();
    const sessions = await db.select({ id: schema.sessions.id, createdAt: schema.sessions.createdAt, expiresAt: schema.sessions.expiresAt, userName: sql`TRIM(${schema.users.firstName} || ' ' || ${schema.users.lastName})`, role: schema.users.role, subiektUzId: schema.users.subiektUzId })
      .from(schema.sessions).innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
      .where(sql`${schema.sessions.expiresAt} > NOW()`).orderBy(sql`${schema.sessions.createdAt} DESC`);
    res.json(sessions.map(s => ({ id: s.id, userName: s.userName || `ID ${s.subiektUzId}`, role: s.role, loginTime: s.createdAt, expiresAt: s.expiresAt, active: new Date(s.expiresAt) > now })));
  } catch { res.json([]); }
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
    const db = getDb(); const adapter = getAdapter(); const pool = await adapter.getPool?.();
    let q = db.select({ code: schema.locations.code, area: schema.locations.area, aisle: schema.locations.aisle, rack: schema.locations.rack, shelf: schema.locations.shelf, productId: schema.productLocations.productId, quantity: schema.productLocations.quantity }).from(schema.productLocations).innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id)).where(eq(schema.locations.area, area));
    if (["exact","shelf","rack"].includes(scope) && aisle) q = (q as any).where(eq(schema.locations.aisle, aisle));
    if (["exact","shelf"].includes(scope) && rack) q = (q as any).where(eq(schema.locations.rack, rack));
    if (["exact"].includes(scope) && shelf) q = (q as any).where(eq(schema.locations.shelf, shelf));
    const rows = await q;
    const grouped = new Map();
    for (const r of rows) { if (!r.productId) continue; const g = grouped.get(r.productId) || { id: r.productId, symbol: "", name: "", unit: "", barcode: "", locations: [], qty: 0, subiektStock: 0 }; g.locations.push(r.code); g.qty += (r.quantity || 0); grouped.set(r.productId, g); }
    if (pool && grouped.size > 0) {
      const ids = [...grouped.keys()];
      const pr = await pool.request().query(`SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name, tw_JednMiary AS unit, tw_PodstKodKresk AS barcode FROM tw__Towar WHERE tw_Id IN (${ids})`);
      for (const p of pr.recordset) { const g = grouped.get((p as any).id); if (g) { g.symbol = (p as any).symbol; g.name = (p as any).name; g.unit = (p as any).unit; g.barcode = (p as any).barcode; } }
      const sr = await pool.request().query(`SELECT st_TowId, SUM(st_Stan) AS total FROM tw_Stan WHERE st_TowId IN (${ids}) GROUP BY st_TowId`);
      for (const s of sr.recordset) { const g = grouped.get((s as any).st_TowId); if (g) g.subiektStock = (s as any).total; }
    }
    res.json({ scope, area, aisle, rack, shelf, products: [...grouped.values()] });
  } catch (err) { logger.error({ err }, "Inventory expected failed"); res.json({ products: [] }); }
});


  logger.info({ port }, "API server started");
});
