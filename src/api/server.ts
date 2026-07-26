import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { MssqlErpAdapter } from "../erp/mssql.adapter.js";
import { MockErpAdapter } from "../erp/mock.adapter.js";
import type { ErpAdapter } from "../erp/adapter.js";
import { getDb, schema } from "../db/index.js";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { authMiddleware, requireAdmin } from "./auth-middleware.js";

const app = express();
app.use(helmet());
app.use(authMiddleware);
app.use(
  cors({
    origin: ["https://pomagier.local", "https://localhost", "http://localhost:5173"],
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

// --- ERP adapter ---
let erpAdapter: ErpAdapter | null = null;
function getAdapter(): ErpAdapter {
  if (!erpAdapter) {
    if (process.env.MSSQL_HOST && process.env.MSSQL_HOST !== "{{MSSQL_HOST}}") {
      erpAdapter = new MssqlErpAdapter();
      logger.info("API using MSSQL adapter");
    } else {
      erpAdapter = new MockErpAdapter();
      logger.info("API using Mock adapter");
    }
  }
  return erpAdapter;
}

// --- Auth helpers ---
function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// --- Field mapping helpers ---
async function getLocationField(): Promise<string> {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.config)
      .where(eq(schema.config.key, "fieldmap_location"));
    return row?.value || "tw_Pole1";
  } catch {
    return "tw_Pole1";
  }
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

    if (user.pin !== hashPin(pin)) {
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
app.post("/api/test-connection", async (req, res) => {
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

// --- Lokalizacje (tylko Postgres) ---
app.get("/api/locations", async (_req, res) => {
  try {
    const db = getDb();
    const { sortLocations } = await import("../lib/locations.js");
    const rows = await db.select().from(schema.locations).orderBy(schema.locations.code);

    const parsed = rows.map((r) => ({
      raw: r.code,
      area: r.area,
      aisle: r.aisle,
      rack: r.rack,
      shelf: r.shelf,
      spot: r.spot,
      label: r.label,
    }));

    res.json(sortLocations(parsed));
  } catch {
    res.json([]);
  }
});

// --- Import lokalizacji z Subiekta (jednorazowo) ---
app.post("/api/locations/import", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });

    const locationField = await getLocationField();
    const result = await pool.request().query(`
      SELECT NULLIF(${locationField}, '') AS location
      FROM tw__Towar
      WHERE ${locationField} IS NOT NULL AND ${locationField} != ''
      GROUP BY ${locationField}
    `);

    const { parseLocation } = await import("../lib/locations.js");
    const db = getDb();

    // Normalize existing entries (fix missing spaces)
    const existing = await db.select().from(schema.locations);
    for (const loc of existing) {
      const parsed = parseLocation(loc.code);
      if (parsed && parsed.raw !== loc.code) {
        // Delete old malformed, insert corrected
        await db.delete(schema.locations).where(eq(schema.locations.id, loc.id));
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
        } catch {
          /* skip if already exists */
        }
      }
    }

    let imported = 0;
    let skipped = 0;

    for (const row of result.recordset) {
      const raw = (row as any).location as string;
      // Obsługa wielu lokalizacji oddzielonych średnikiem
      const parts = raw
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

    logger.info({ imported, skipped }, "Location import completed");
    res.json({ ok: true, imported, skipped });
  } catch (err) {
    logger.error({ err }, "Import failed");
    res.status(500).json({ error: "Import nie powiódł się" });
  }
});

// --- Dodaj nową lokalizację ---
app.post("/api/locations", async (req, res) => {
  const { code } = req.body ?? {};
  if (!code) {
    res.status(400).json({ error: "Brak kodu lokalizacji" });
    return;
  }

  const { parseLocation } = await import("../lib/locations.js");
  const parsed = parseLocation(code);
  if (!parsed) {
    res.status(422).json({ error: "Nieprawidłowy format lokalizacji. Oczekiwano: A 1-2-3-4" });
    return;
  }

  try {
    const db = getDb();

    // Sprawdź duplikat
    const [existing] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.code, parsed.raw));
    if (existing) {
      res.status(409).json({ error: "Lokalizacja już istnieje", location: existing });
      return;
    }

    const [created] = await db
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
      .returning();

    logger.info({ code: parsed.raw }, "New location added");
    res.status(201).json({ ok: true, location: created });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Lokalizacja już istnieje" });
      return;
    }
    logger.error({ err }, "Failed to add location");
    res.status(500).json({ error: "Błąd zapisu" });
  }
});

// --- Produkty w lokalizacji ---
app.get("/api/products-by-location", async (req, res) => {
  const location = req.query.location as string;
  if (!location) {
    res.status(400).json({ error: "Brak parametru location" });
    return;
  }
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.json([]);

    const result = await pool.request().input("location", location).query(`
        SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name, tw_Pole1 AS location,
               tw_JednMiary AS unit, tw_PodstKodKresk AS barcode
        FROM tw__Towar
        WHERE tw_Pole1 = @location
        ORDER BY tw_Symbol
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error({ err }, "Products by location failed");
    res.json([]);
  }
});

// --- Aktualizuj lokalizację produktu w Subiekt GT ---
app.put("/api/products/:id/location", async (req, res) => {
  const productId = parseInt(req.params.id);
  const { location } = req.body ?? {};

  if (!productId || !location) {
    res.status(400).json({ error: "Brak productId lub location" });
    return;
  }

  const { parseLocation } = await import("../lib/locations.js");
  const parsed = parseLocation(location);
  if (!parsed) {
    res.status(422).json({ error: "Nieprawidłowy format lokalizacji" });
    return;
  }

  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });

    const locationField = await getLocationField();

    // Pobierz aktualną wartość pola
    const current = await pool
      .request()
      .input("id", parseInt(productId as any))
      .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);

    const existing = (current.recordset[0] as any)?.val || "";
    const locations = existing
      .split(";")
      .map((s: string) => s.trim())
      .filter(Boolean);

    // Sprawdź czy lokalizacja już istnieje
    if (locations.includes(parsed.raw)) {
      res.json({ ok: true, location: parsed.raw, message: "Lokalizacja już przypisana" });
      return;
    }

    // Dodaj nową lokalizację (oddziel średnikiem)
    locations.push(parsed.raw);
    const newValue = locations.join(";");

    await pool
      .request()
      .input("id", parseInt(productId as any))
      .input("val", newValue)
      .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);

    logger.info(
      { productId, location: parsed.raw, field: locationField, value: newValue },
      "Product location updated in Subiekt",
    );
    res.json({ ok: true, location: parsed.raw, field: locationField, value: newValue });
  } catch (err) {
    logger.error({ err, productId, location }, "Failed to update product location");
    res.status(500).json({ error: "Błąd zapisu do Subiekt GT" });
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

// --- Synchronizuj product_locations z Subiekt GT ---
app.post("/api/locations/sync", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });

    const locationField = await getLocationField();
    const { parseLocation } = await import("../lib/locations.js");
    const db = getDb();

    // Pobierz wszystkie towary z lokalizacjami
    const result = await pool.request().query(`
      SELECT tw_Id AS productId, NULLIF(${locationField}, '') AS locRaw
      FROM tw__Towar
      WHERE ${locationField} IS NOT NULL AND ${locationField} != ''
    `);

    // Pobierz wszystkie lokalizacje z Postgres
    const allLocations = await db.select().from(schema.locations);

    let inserted = 0;
    let skipped = 0;

    // Wyczyść starą tabelę
    await db.delete(schema.productLocations);

    for (const row of result.recordset) {
      const productId = (row as any).productId;
      const locRaw = (row as any).locRaw as string;
      const parts = locRaw
        .split(";")
        .map((s: string) => s.trim())
        .filter(Boolean);

      for (const part of parts) {
        const parsed = parseLocation(part);
        if (!parsed) {
          skipped++;
          continue;
        }

        const loc = allLocations.find((l) => l.code === parsed.raw);
        if (!loc) {
          skipped++;
          continue;
        }

        try {
          await db
            .insert(schema.productLocations)
            .values({
              productId,
              locationId: loc.id,
              quantity: 1,
            })
            .onConflictDoNothing();
          inserted++;
        } catch {
          skipped++;
        }
      }
    }

    logger.info({ inserted, skipped }, "Product-location sync completed");
    res.json({ ok: true, inserted, skipped });
  } catch (err) {
    logger.error({ err }, "Sync failed");
    res.status(500).json({ error: "Synchronizacja nie powiodła się" });
  }
});

// --- Zmiana PIN użytkownika ---
app.put("/api/users/:subiektId/pin", requireAdmin, async (req, res) => {
  const subiektUzId = parseInt(req.params.subiektId as string);
  const { pin } = req.body ?? {};

  if (!subiektUzId || !pin || pin.length < 4 || pin.length > 8) {
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

// --- Przypisz towary do lokalizacji ---
app.post("/api/locations/assign", async (req, res) => {
  const { codes, location } = req.body ?? {};
  if (!Array.isArray(codes) || codes.length === 0 || !location) {
    res.status(400).json({ error: "Brak kodów lub lokalizacji" });
    return;
  }

  const { parseLocation } = await import("../lib/locations.js");
  const parsed = parseLocation(location);
  if (!parsed) {
    res.status(422).json({ error: "Nieprawidłowy format lokalizacji" });
    return;
  }

  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });

    // Upewnij się że lokalizacja istnieje w Postgres
    let [loc] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.code, parsed.raw));
    if (!loc) {
      [loc] = await db
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
        .returning();
    }

    // Znajdź produkty w Subiekcie po symbolu lub EAN
    const foundProducts: { id: number; symbol: string; name: string }[] = [];
    const notFound: string[] = [];

    for (const code of codes) {
      const result = await pool.request().input("code", code).query(`
        SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name
        FROM tw__Towar
        WHERE tw_PodstKodKresk = @code
      `);
      if (result.recordset.length > 0) {
        foundProducts.push(result.recordset[0] as any);
      } else {
        notFound.push(code);
      }
    }

    if (foundProducts.length === 0) {
      res.status(404).json({ error: "Nie znaleziono żadnego towaru", notFound });
      return;
    }

    // Sumuj duplikaty
    const grouped = new Map<number, number>();
    for (const p of foundProducts) {
      grouped.set(p.id, (grouped.get(p.id) || 0) + 1);
    }

    // Zapisz do product_locations
    const locationField = await getLocationField();
    for (const [productId, qty] of grouped) {
      await db
        .insert(schema.productLocations)
        .values({ productId, locationId: loc.id, quantity: qty })
        .onConflictDoUpdate({
          target: [schema.productLocations.productId, schema.productLocations.locationId],
          set: { quantity: sql`${schema.productLocations.quantity} + ${qty}` },
        });

      // Aktualizuj tw_Pole1 w Subiekcie
      const current = await pool
        .request()
        .input("id", productId)
        .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
      const existing = ((current.recordset[0] as any)?.val || "")
        .split(";")
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!existing.includes(parsed.raw)) {
        existing.push(parsed.raw);
        await pool
          .request()
          .input("id", productId)
          .input("val", existing.join(";"))
          .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);
      }
    }

    logger.info(
      { productCount: grouped.size, totalQty: foundProducts.length, location: parsed.raw },
      "Products assigned to location",
    );

    // Log movements
    for (const [productId, qty] of grouped) {
      const p = foundProducts.find((fp) => fp.id === productId)!;
      await db.insert(schema.productMovements).values({
        productId,
        symbol: p.symbol,
        name: p.name,
        toLocationId: loc.id,
        toCode: parsed.raw,
        quantity: qty,
        operator: "operator",
        correlationId: crypto.randomUUID(),
      });
    }
    res.json({
      ok: true,
      assigned: grouped.size,
      totalQuantity: foundProducts.length,
      location: parsed.raw,
      products: [...grouped].map(([id, qty]) => {
        const p = foundProducts.find((fp) => fp.id === id)!;
        return { symbol: p.symbol, name: p.name, quantity: qty };
      }),
      notFound,
    });
  } catch (err) {
    logger.error({ err }, "Assign failed");
    res.status(500).json({ error: "Błąd zapisu" });
  }
});

// --- Lokalizacje z liczbą produktów i ilościami ---
app.get("/api/locations/stats", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        code: schema.locations.code,
        area: schema.locations.area,
        aisle: schema.locations.aisle,
        rack: schema.locations.rack,
        shelf: schema.locations.shelf,
        label: schema.locations.label,
        productCount: sql<number>`COUNT(${schema.productLocations.productId})::int`,
        totalQuantity: sql<number>`COALESCE(SUM(${schema.productLocations.quantity}), 0)::int`,
      })
      .from(schema.locations)
      .leftJoin(
        schema.productLocations,
        eq(schema.locations.id, schema.productLocations.locationId),
      )
      .groupBy(schema.locations.id)
      .orderBy(schema.locations.code);

    res.json(rows);
  } catch {
    res.json([]);
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

// --- Cofnij ostatnią operację przypisania ---
app.post("/api/locations/undo", async (req, res) => {
  const { location, codes } = req.body ?? {};
  if (!location || !Array.isArray(codes) || codes.length === 0) {
    res.status(400).json({ error: "Brak lokalizacji lub kodów" });
    return;
  }

  const { parseLocation } = await import("../lib/locations.js");
  const parsed = parseLocation(location);
  if (!parsed) {
    res.status(422).json({ error: "Nieprawidłowa lokalizacja" });
    return;
  }

  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();

    // Find location in Postgres
    const [loc] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.code, parsed.raw));
    if (!loc) {
      res.status(404).json({ error: "Lokalizacja nie istnieje" });
      return;
    }

    let undone = 0;
    for (const code of codes) {
      if (!pool) break;
      const result = await pool
        .request()
        .input("code", code)
        .query("SELECT tw_Id AS id FROM tw__Towar WHERE tw_PodstKodKresk = @code");
      for (const row of result.recordset) {
        const productId = (row as any).id;
        // Decrease quantity in product_locations (or remove if quantity gets to 0)
        await db
          .delete(schema.productLocations)
          .where(
            and(
              eq(schema.productLocations.productId, productId),
              eq(schema.productLocations.locationId, loc.id),
            ),
          );

        // Remove location from tw_Pole1 in Subiekt
        const locationField = await getLocationField();
        const current = await pool
          .request()
          .input("id", productId)
          .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
        const existing = ((current.recordset[0] as any)?.val || "")
          .split(";")
          .map((s: string) => s.trim())
          .filter(Boolean);
        const updated = existing.filter((s: string) => s !== parsed.raw);
        if (updated.length !== existing.length) {
          await pool
            .request()
            .input("id", productId)
            .input("val", updated.join(";") || null)
            .query(`UPDATE tw__Towar SET ${locationField} = NULLIF(@val, '') WHERE tw_Id = @id`);
        }
        undone++;
      }
    }

    logger.info({ location: parsed.raw, undone }, "Assignment undone");

    // Log undo movements
    for (const code of [...new Set(codes)]) {
      if (!pool) break;
      const r = await pool
        .request()
        .input("code", code)
        .query(
          "SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name FROM tw__Towar WHERE tw_PodstKodKresk = @code",
        );
      for (const row of r.recordset) {
        await db.insert(schema.productMovements).values({
          productId: (row as any).id,
          symbol: (row as any).symbol,
          name: (row as any).name,
          fromLocationId: loc.id,
          fromCode: parsed.raw,
          quantity: 1,
          operator: "operator",
          correlationId: crypto.randomUUID(),
        });
      }
    }
    res.json({ ok: true, undone });
  } catch (err) {
    logger.error({ err }, "Undo failed");
    res.status(500).json({ error: "Nie udało się cofnąć" });
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

// --- Weryfikacja stanu: Postgres vs Subiekt ---
app.get("/api/locations/verify", async (req, res) => {
  const location = req.query.location as string;
  if (!location) {
    res.status(400).json({ error: "Brak parametru location" });
    return;
  }

  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();

    // Assigned quantity from Postgres
    const [loc] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.code, location));
    if (!loc) {
      res.json({ comparison: null });
      return;
    }

    const plRows = await db
      .select({ qty: schema.productLocations.quantity })
      .from(schema.productLocations)
      .where(eq(schema.productLocations.locationId, loc.id));
    const assigned = plRows.reduce((s, r) => s + (r.qty || 0), 0);

    // Stock in Subiekt
    let inSubiekt = 0;
    if (pool) {
      const stockResult = await pool.request().input("location", location)
        .query(`SELECT ISNULL(SUM(s.st_Stan), 0) AS total FROM tw_Stan s
                INNER JOIN tw__Towar t ON t.tw_Id = s.st_TowId
                WHERE t.tw_Pole1 LIKE '%' + @location + '%'`);
      inSubiekt = (stockResult.recordset[0] as any)?.total || 0;
    }

    res.json({ comparison: { location, assigned, inSubiekt } });
  } catch {
    res.json({ comparison: null });
  }
});

// --- Duplikaty: towary w odległych lokalizacjach ---
app.get("/api/locations/duplicates", async (_req, res) => {
  try {
    const db = getDb();
    const { parseLocation } = await import("../lib/locations.js");

    const rows = await db
      .select({
        productId: schema.productLocations.productId,
        quantity: schema.productLocations.quantity,
        code: schema.locations.code,
        area: schema.locations.area,
        aisle: schema.locations.aisle,
        rack: schema.locations.rack,
      })
      .from(schema.productLocations)
      .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id));

    // Group by productId
    const grouped = new Map<
      number,
      {
        productId: number;
        locations: { code: string; area: string; aisle: number; rack: number; quantity: number }[];
      }
    >();
    for (const r of rows) {
      const g = grouped.get(r.productId) || { productId: r.productId, locations: [] };
      g.locations.push({
        code: r.code,
        area: r.area,
        aisle: r.aisle,
        rack: r.rack,
        quantity: r.quantity || 0,
      });
      grouped.set(r.productId, g);
    }

    // Find products in >1 location that are distant
    const duplicates: any[] = [];
    for (const [, g] of grouped) {
      if (g.locations.length < 2) continue;
      const hasDistant = g.locations.some((a) =>
        g.locations.some(
          (b) => a.code !== b.code && (a.area !== b.area || Math.abs(a.aisle - b.aisle) > 1),
        ),
      );
      if (!hasDistant) continue;

      // Get product info from Subiekt if available
      let symbol = "",
        name = "";
      try {
        const pool = await getAdapter().getPool?.();
        if (pool) {
          const pr = await pool
            .request()
            .input("id", g.productId)
            .query("SELECT tw_Symbol, tw_Nazwa FROM tw__Towar WHERE tw_Id = @id");
          if (pr.recordset[0]) {
            symbol = (pr.recordset[0] as any).tw_Symbol;
            name = (pr.recordset[0] as any).tw_Nazwa;
          }
        }
      } catch {}

      const best = g.locations.reduce((a, b) => (a.quantity > b.quantity ? a : b));
      duplicates.push({
        productId: g.productId,
        symbol,
        name,
        locations: g.locations,
        suggestion: best.code,
      });
    }

    res.json(duplicates);
  } catch {
    res.json([]);
  }
});

// --- Sprawdź czy produkt istnieje już w jakiejś lokalizacji ---
app.get("/api/locations/check-product", async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    res.json({ found: false });
    return;
  }

  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();

    // Find product in Subiekt
    if (!pool) {
      res.json({ found: false });
      return;
    }
    const pr = await pool
      .request()
      .input("code", code)
      .query("SELECT tw_Id AS id FROM tw__Towar WHERE tw_PodstKodKresk = @code");
    if (!pr.recordset[0]) {
      res.json({ found: false });
      return;
    }
    const productId = (pr.recordset[0] as any).id;

    // Check in product_locations
    const rows = await db
      .select({ code: schema.locations.code })
      .from(schema.productLocations)
      .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id))
      .where(eq(schema.productLocations.productId, productId));

    res.json({ found: rows.length > 0, locations: rows.map((r) => r.code) });
  } catch {
    res.json({ found: false });
  }
});

// --- Przenieś towary między lokalizacjami ---
app.post("/api/locations/transfer", async (req, res) => {
  const { codes, fromLocation, toLocation } = req.body ?? {};
  if (!Array.isArray(codes) || codes.length === 0 || !fromLocation || !toLocation) {
    res.status(400).json({ error: "Brak kodów, źródła lub celu" });
    return;
  }

  const { parseLocation } = await import("../lib/locations.js");
  const fromParsed = parseLocation(fromLocation);
  const toParsed = parseLocation(toLocation);
  if (!fromParsed || !toParsed) {
    res.status(422).json({ error: "Nieprawidłowy format lokalizacji" });
    return;
  }

  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
    const locationField = await getLocationField();

    // Ensure both locations exist
    let [fromLoc] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.code, fromParsed.raw));
    if (!fromLoc) {
      [fromLoc] = await db
        .insert(schema.locations)
        .values({
          code: fromParsed.raw,
          area: fromParsed.area,
          aisle: fromParsed.aisle,
          rack: fromParsed.rack,
          shelf: fromParsed.shelf,
          spot: fromParsed.spot,
          label: fromParsed.label,
        })
        .returning();
    }
    let [toLoc] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.code, toParsed.raw));
    if (!toLoc) {
      [toLoc] = await db
        .insert(schema.locations)
        .values({
          code: toParsed.raw,
          area: toParsed.area,
          aisle: toParsed.aisle,
          rack: toParsed.rack,
          shelf: toParsed.shelf,
          spot: toParsed.spot,
          label: toParsed.label,
        })
        .returning();
    }

    // Find products
    const foundProducts: { id: number; symbol: string; name: string }[] = [];
    for (const code of codes) {
      const r = await pool
        .request()
        .input("code", code)
        .query(
          "SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name FROM tw__Towar WHERE tw_PodstKodKresk = @code",
        );
      for (const row of r.recordset) foundProducts.push(row as any);
    }

    // Group quantities
    const grouped = new Map<number, number>();
    for (const p of foundProducts) grouped.set(p.id, (grouped.get(p.id) || 0) + 1);

    let moved = 0;
    for (const [productId, qty] of grouped) {
      const p = foundProducts.find((fp) => fp.id === productId)!;

      // Remove from source location
      await db
        .delete(schema.productLocations)
        .where(
          and(
            eq(schema.productLocations.productId, productId),
            eq(schema.productLocations.locationId, fromLoc.id),
          ),
        );

      // Add to target location
      await db
        .insert(schema.productLocations)
        .values({ productId, locationId: toLoc.id, quantity: qty })
        .onConflictDoUpdate({
          target: [schema.productLocations.productId, schema.productLocations.locationId],
          set: { quantity: sql`${schema.productLocations.quantity} + ${qty}` },
        });

      // Update Subiekt: remove from source, add to target
      const currentSourceRes = await pool
        .request()
        .input("id", productId)
        .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
      const currentSourceVal = (currentSourceRes.recordset[0] as any)?.val || "";
      const locations = currentSourceVal
        .split(";")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const updated = locations.filter((s: string) => s !== fromParsed.raw);
      if (!updated.includes(toParsed.raw)) updated.push(toParsed.raw);
      await pool
        .request()
        .input("id", productId)
        .input("val", updated.join(";"))
        .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);

      // Log movement
      await db.insert(schema.productMovements).values({
        productId,
        symbol: p.symbol,
        name: p.name,
        fromLocationId: fromLoc.id,
        toLocationId: toLoc.id,
        fromCode: fromParsed.raw,
        toCode: toParsed.raw,
        quantity: qty,
        operator: "operator",
        correlationId: crypto.randomUUID(),
      });

      moved += qty;
    }

    logger.info({ from: fromParsed.raw, to: toParsed.raw, moved }, "Transfer completed");
    res.json({ ok: true, moved, from: fromParsed.raw, to: toParsed.raw });
  } catch (err) {
    logger.error({ err }, "Transfer failed");
    res.status(500).json({ error: "Transfer nie powiódł się" });
  }
});

// --- Weryfikacja spójności Postgres ↔ Subiekt tw_PoleX ---
app.get("/api/locations/verify-sync", async (_req, res) => {
  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
    const locationField = await getLocationField();

    // Get all products with their Postgres locations
    const plRows = await db
      .select({ productId: schema.productLocations.productId, code: schema.locations.code })
      .from(schema.productLocations)
      .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id));

    // Group by productId
    const postgresMap = new Map<number, Set<string>>();
    for (const r of plRows) {
      const s = postgresMap.get(r.productId) || new Set();
      s.add(r.code);
      postgresMap.set(r.productId, s);
    }

    // Get Subiekt data
    const subiektRows = await pool
      .request()
      .query(
        `SELECT tw_Id AS id, NULLIF(${locationField}, '') AS val FROM tw__Towar WHERE ${locationField} IS NOT NULL AND ${locationField} != ''`,
      );

    const subiektMap = new Map<number, Set<string>>();
    for (const r of subiektRows.recordset) {
      const codes = ((r as any).val || "")
        .split(";")
        .map((s: string) => s.trim())
        .filter(Boolean);
      subiektMap.set((r as any).id, new Set(codes));
    }

    // Compare
    const allIds = new Set([...postgresMap.keys(), ...subiektMap.keys()]);
    const mismatches: { productId: number; postgres: string[]; subiekt: string[] }[] = [];

    for (const id of allIds) {
      const pg = [...(postgresMap.get(id) || new Set())].sort();
      const sub = [...(subiektMap.get(id) || new Set())].sort();
      if (pg.join(",") !== sub.join(",")) {
        mismatches.push({ productId: id, postgres: pg, subiekt: sub });
      }
    }

    res.json({
      totalProducts: allIds.size,
      synced: allIds.size - mismatches.length,
      mismatches: mismatches.length,
      details: mismatches.slice(0, 20),
    });
  } catch (err) {
    logger.error({ err }, "Verify sync failed");
    res.status(500).json({ error: "Weryfikacja nie powiodła się" });
  }
});

// --- Siatka magazynu (grid data) ---
app.get("/api/locations/grid", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        area: schema.locations.area,
        aisle: schema.locations.aisle,
        shelf: schema.locations.shelf,
        sampleCode: sql<string>`MIN(${schema.locations.code})`,
        productCount: sql<number>`COUNT(${schema.productLocations.productId})::int`,
        totalQuantity: sql<number>`COALESCE(SUM(${schema.productLocations.quantity}), 0)::int`,
      })
      .from(schema.locations)
      .leftJoin(
        schema.productLocations,
        eq(schema.locations.id, schema.productLocations.locationId),
      )
      .groupBy(schema.locations.area, schema.locations.aisle, schema.locations.shelf)
      .orderBy(schema.locations.area, schema.locations.aisle, schema.locations.shelf);

    // Build grid structure
    const areas = new Map<
      string,
      {
        aisles: Map<
          number,
          Map<number, { code: string; productCount: number; totalQuantity: number }>
        >;
        maxAisle: number;
        maxShelf: number;
      }
    >();

    for (const r of rows) {
      if (!areas.has(r.area)) areas.set(r.area, { aisles: new Map(), maxAisle: 0, maxShelf: 0 });
      const area = areas.get(r.area)!;
      if (!area.aisles.has(r.aisle)) area.aisles.set(r.aisle, new Map());
      area.aisles
        .get(r.aisle)!
        .set(r.shelf, {
          code: r.sampleCode,
          productCount: r.productCount,
          totalQuantity: r.totalQuantity,
        });
      if (r.aisle > area.maxAisle) area.maxAisle = r.aisle;
      if (r.shelf > area.maxShelf) area.maxShelf = r.shelf;
    }

    const result: any = {};
    for (const [areaName, area] of areas) {
      result[areaName] = { maxAisle: area.maxAisle, maxShelf: area.maxShelf, grid: {} };
      for (const [aisle, shelves] of area.aisles) {
        result[areaName].grid[aisle] = {};
        for (const [shelf, cell] of shelves) {
          result[areaName].grid[aisle][shelf] = {
            code: cell.code,
            productCount: cell.productCount,
            totalQuantity: cell.totalQuantity,
          };
        }
      }
    }

    res.json(result);
  } catch {
    res.json({});
  }
});

// --- Puste lokalizacje ---
app.get("/api/locations/empty", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        code: schema.locations.code,
        area: schema.locations.area,
        aisle: schema.locations.aisle,
        rack: schema.locations.rack,
        shelf: schema.locations.shelf,
        label: schema.locations.label,
      })
      .from(schema.locations)
      .leftJoin(
        schema.productLocations,
        eq(schema.locations.id, schema.productLocations.locationId),
      )
      .where(sql`${schema.productLocations.productId} IS NULL`)
      .orderBy(schema.locations.area, schema.locations.aisle, schema.locations.rack);

    res.json(rows);
  } catch {
    res.json([]);
  }
});

// --- Eksport etykiet PDF z kodami Code 128 ---
app.get("/api/locations/export-pdf", async (req, res) => {
  const codes = ((req.query.codes as string) || "").split(",").filter(Boolean);
  if (codes.length === 0) {
    res.status(400).json({ error: "Brak kodów" });
    return;
  }

  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const cols = 3;
    const rows = 8;
    const cellW = 60;
    const cellH = 30;
    const marginX = 12;
    const marginY = 15;
    const fontSize = 8;

    codes.slice(0, cols * rows).forEach((code, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = marginX + col * cellW;
      const y = marginY + row * cellH;

      // Border
      doc.setDrawColor(200);
      doc.setLineWidth(0.2);
      doc.rect(x, y, cellW - 2, cellH - 2);

      // Barcode placeholder (Code 128 text)
      doc.setFontSize(fontSize + 2);
      doc.text(code, x + (cellW - 2) / 2, y + 8, { align: "center" });

      // Label
      doc.setFontSize(fontSize - 2);
      doc.setTextColor(100);
      const loc = code.match(/^([A-Z])\s*(\d+)-(\d+)-(\d+)-(\d+)$/);
      const label = loc ? `A:${loc[1]} | Rząd:${loc[2]} | Regał:${loc[3]} | Półka:${loc[4]}` : code;
      doc.text(label, x + (cellW - 2) / 2, y + 14, { align: "center" });
      doc.text("PomagierGT", x + (cellW - 2) / 2, y + 20, { align: "center" });
      doc.setTextColor(0);
    });

    const pdf = Buffer.from(doc.output("arraybuffer"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=labels.pdf");
    res.send(pdf);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "PDF generation failed" });
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

// --- Napraw rozbieżności: zsynchronizuj Subiekt z Postgres ---
app.post("/api/locations/fix-sync", async (_req, res) => {
  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
    const locationField = await getLocationField();

    const plRows = await db
      .select({ productId: schema.productLocations.productId, code: schema.locations.code })
      .from(schema.productLocations)
      .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id));
    const postgresMap = new Map<number, string[]>();
    for (const r of plRows) {
      const list = postgresMap.get(r.productId) || [];
      list.push(r.code);
      postgresMap.set(r.productId, list);
    }

    let fixed = 0;
    for (const [productId, codes] of postgresMap) {
      const current = await pool
        .request()
        .input("id", productId)
        .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
      const existing = ((current.recordset[0] as any)?.val || "")
        .split(";")
        .map((s: string) => s.trim())
        .filter(Boolean);
      if ([...codes].sort().join(";") !== [...existing].sort().join(";")) {
        await pool
          .request()
          .input("id", productId)
          .input("val", codes.join(";"))
          .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);
        fixed++;
      }
    }
    res.json({ ok: true, fixed });
  } catch (err) {
    logger.error({ err }, "Fix sync failed");
    res.status(500).json({ error: "Naprawa nie powiodła się" });
  }
});

// --- Wyczyść pole lokalizacji w Subiekcie ---
app.post("/api/locations/clear-field", async (_req, res) => {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
    const locationField = await getLocationField();
    const result = await pool
      .request()
      .query(`UPDATE tw__Towar SET ${locationField} = '' WHERE ${locationField} IS NOT NULL`);
    res.json({ ok: true, rowsAffected: result.rowsAffected?.[0] || 0 });
  } catch (err) {
    logger.error({ err }, "Clear field failed");
    res.status(500).json({ error: "Nie udało się" });
  }
});

// --- Fix sync per selected products ---
app.post("/api/locations/fix-sync-batch", async (req, res) => {
  const { productIds, direction } = req.body ?? {};
  if (!Array.isArray(productIds) || productIds.length === 0) {
    res.status(400).json({ error: "Brak productIds" });
    return;
  }

  try {
    const db = getDb();
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
    const locationField = await getLocationField();

    if (direction === "postgres-to-subiekt") {
      const plRows = await db
        .select({ productId: schema.productLocations.productId, code: schema.locations.code })
        .from(schema.productLocations)
        .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id));
      const map = new Map<number, string[]>();
      for (const r of plRows) {
        if (productIds.includes(r.productId)) {
          const list = map.get(r.productId) || [];
          list.push(r.code);
          map.set(r.productId, list);
        }
      }
      let fixed = 0;
      for (const [id, codes] of map) {
        await pool
          .request()
          .input("id", id)
          .input("val", codes.join(";"))
          .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);
        fixed++;
      }
      res.json({ ok: true, fixed });
    } else if (direction === "subiekt-to-postgres") {
      // Re-sync from Subiekt for selected products
      let imported = 0;
      for (const id of productIds) {
        const [current] = await db
          .select()
          .from(schema.productLocations)
          .where(eq(schema.productLocations.productId, id));
        const subiektRow = await pool
          .request()
          .input("id", id)
          .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
        const codes = ((subiektRow.recordset[0] as any)?.val || "")
          .split(";")
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (current)
          await db.delete(schema.productLocations).where(eq(schema.productLocations.productId, id));
        for (const code of codes) {
          const [loc] = await db
            .select()
            .from(schema.locations)
            .where(eq(schema.locations.code, code));
          if (loc) {
            await db
              .insert(schema.productLocations)
              .values({ productId: id, locationId: loc.id, quantity: 1 })
              .onConflictDoNothing();
            imported++;
          }
        }
      }
      res.json({ ok: true, imported });
    } else if (direction === "clear") {
      for (const id of productIds) {
        await pool
          .request()
          .input("id", id)
          .query(`UPDATE tw__Towar SET ${locationField} = '' WHERE tw_Id = @id`);
        await db.delete(schema.productLocations).where(eq(schema.productLocations.productId, id));
      }
      res.json({ ok: true, cleared: productIds.length });
    }
  } catch (err) {
    logger.error({ err }, "Batch fix failed");
    res.status(500).json({ error: "Nie udało się" });
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
app.post("/api/wizard/clear", async (req, res) => {
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
app.post("/api/wizard/import-all", async (_req, res) => {
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
          pin: crypto.createHash("sha256").update("0000").digest("hex"),
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

// === Backup & Restore ===

function validateBackupFilename(name: unknown): name is string {
  return (
    typeof name === "string" &&
    /^[a-zA-Z0-9_.-]+$/.test(name) &&
    name.length > 0 &&
    name.length <= 256
  );
}

// S3 config
app.get("/api/backup/config", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.select().from(schema.config);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    res.json({
      endpoint: map.s3_endpoint || "",
      bucket: map.s3_bucket || "",
      region: map.s3_region || "us-east-1",
      accessKey: map.s3_access_key || "",
      secretKey: map.s3_secret_key ? "••••••••" : "",
    });
  } catch {
    res.json({});
  }
});

app.put("/api/backup/config", requireAdmin, async (req, res) => {
  const { endpoint, bucket, region, accessKey, secretKey } = req.body ?? {};
  if (!endpoint || !bucket || !accessKey) {
    res.status(400).json({ error: "Brak wymaganych pól" });
    return;
  }
  try {
    const db = getDb();
    const { encryptSecret } = await import("../lib/backup-crypto.js");
    const entries: any[] = [
      { key: "s3_endpoint", value: endpoint },
      { key: "s3_bucket", value: bucket },
      { key: "s3_region", value: region || "us-east-1" },
      { key: "s3_access_key", value: accessKey },
    ];
    if (secretKey && secretKey !== "••••••••") {
      entries.push({ key: "s3_secret_key", value: encryptSecret(secretKey) });
    }
    for (const e of entries) {
      await db
        .insert(schema.config)
        .values(e)
        .onConflictDoUpdate({ target: schema.config.key, set: { value: e.value } });
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/backup/test-s3", requireAdmin, async (req, res) => {
  const { endpoint, bucket, region, accessKey, secretKey } = req.body ?? {};
  if (!endpoint || !bucket || !accessKey) {
    res.status(400).json({ error: "Brak wymaganych pól" });
    return;
  }
  try {
    const { testS3Connection } = await import("../lib/backup-s3.js");
    const result = await testS3Connection({ endpoint, bucket, region, accessKey, secretKey });
    res.json(result);
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

// Run backup now
app.post("/api/backup/run", requireAdmin, async (_req, res) => {
  try {
    const { execSync } = await import("node:child_process");
    const output = execSync("bash /pomagier/scripts/backup.sh 2>&1", {
      timeout: 120000,
    }).toString();
    const match = output.match(/pomagier_backup_\d{4}-\d{2}-\d{2}_\d{4}\.tar\.gz/);
    res.json({ ok: true, filename: match?.[0] || "unknown", output: output.slice(-200) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || err.stderr?.toString() });
  }
});

// List backups
app.get("/api/backup/list", async (_req, res) => {
  const localDir = "/backups/local";
  const local: { name: string; size: number; date: string; source: string }[] = [];
  try {
    const { readdirSync, statSync } = await import("node:fs");
    for (const f of readdirSync(localDir)) {
      if (!f.endsWith(".tar.gz")) continue;
      const stat = statSync(`${localDir}/${f}`);
      local.push({ name: f, size: stat.size, date: stat.mtime.toISOString(), source: "local" });
    }
  } catch {}

  let s3: any[] = [];
  try {
    const { listS3Files } = await import("../lib/backup-s3.js");
    const files = await listS3Files();
    s3 = files.map((f) => ({ name: f, size: 0, date: new Date().toISOString(), source: "s3" }));
  } catch {}

  res.json(
    [...local, ...s3].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  );
});

// Download backup
app.get("/api/backup/download/:name", requireAdmin, async (req, res) => {
  const name = req.params.name;
  if (!validateBackupFilename(name)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const source = req.query.source || "local";
  try {
    if (source === "s3") {
      const { downloadFromS3 } = await import("../lib/backup-s3.js");
      const data = await downloadFromS3(name);
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename=${name}`);
      res.send(data);
    } else {
      const localPath = `/backups/local/${name}`;
      const { existsSync } = await import("node:fs");
      if (existsSync(localPath)) {
        res.download(localPath);
      } else {
        res.status(404).json({ error: "File not found" });
      }
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete backup
app.delete("/api/backup/:name", requireAdmin, async (req, res) => {
  const name = req.params.name;
  if (!validateBackupFilename(name)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const source = req.query.source || "local";
  try {
    if (source === "s3") {
      const { deleteFromS3 } = await import("../lib/backup-s3.js");
      await deleteFromS3(name);
    }
    const localPath = `/backups/local/${name}`;
    const { unlinkSync, existsSync } = await import("node:fs");
    if (existsSync(localPath)) unlinkSync(localPath);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Restore from uploaded file
app.post("/api/backup/restore", requireAdmin, async (req, res) => {
  const { filename, confirm } = req.body ?? {};
  if (confirm !== "TAK") {
    res.status(400).json({ error: "Wpisz TAK aby potwierdzić przywrócenie" });
    return;
  }
  if (!validateBackupFilename(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  try {
    const { execSync } = await import("node:child_process");
    const localPath = `/backups/local/${filename}`;
    execSync(`cd /tmp && tar -xzf "${localPath}"`, { timeout: 30000 });
    const sqlFile = filename.replace(".tar.gz", ".sql");
    execSync(`docker exec -i pomagier-db psql -U pomagier pomagier < /tmp/${sqlFile}`, {
      timeout: 60000,
    });
    execSync(`rm -f /tmp/${sqlFile} /tmp/config_*.tar.gz`);
    res.json({
      ok: true,
      message: "Baza przywrócona. Zrestartuj API aby załadować nową konfigurację.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || err.stderr?.toString() });
  }
});

// Upload local backup to S3
app.post("/api/backup/upload-local", requireAdmin, async (req, res) => {
  const { file } = req.body ?? {};
  if (!validateBackupFilename(file)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  try {
    const localPath = `/backups/local/${file}`;
    const { readFileSync } = await import("node:fs");
    const data = readFileSync(localPath);
    const { uploadToS3 } = await import("../lib/backup-s3.js");
    await uploadToS3(file, data);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(200).json({ ok: false, error: err.message });
  }
});

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


// --- Reset: wszystkie lokalizacje produktu → tylko ta jedna ---
app.post("/api/locations/reset", async (req, res) => {
  const { codes, location } = req.body ?? {};
  if (!Array.isArray(codes) || !location) { res.status(400).json({ error: "Brak kodów lub lokalizacji" }); return; }
  const { parseLocation } = await import("../lib/locations.ts");
  const parsed = parseLocation(location);
  if (!parsed) { res.status(422).json({ error: "Nieprawidlowy format" }); return; }
  try {
    const db = getDb(); const adapter = getAdapter(); const pool = await adapter.getPool?.();
    if (!pool) return res.status(503).json({ error: "MSSQL niedostepny" });
    const locationField = await getLocationField();
    let [loc] = await db.select().from(schema.locations).where(eq(schema.locations.code, parsed.raw));
    if (!loc) { [loc] = await db.insert(schema.locations).values({ code: parsed.raw, area: parsed.area, aisle: parsed.aisle, rack: parsed.rack, shelf: parsed.shelf, spot: parsed.spot, label: parsed.label }).returning(); }
    let reset = 0;
    for (const code of codes) {
      const r = await pool.request().input("code", code).query("SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name FROM tw__Towar WHERE tw_PodstKodKresk = @code");
      for (const row of r.recordset) {
        const productId = (row as any).id;
        await db.delete(schema.productLocations).where(eq(schema.productLocations.productId, productId));
        await db.insert(schema.productLocations).values({ productId, locationId: loc.id, quantity: 1 });
        await pool.request().input("id", productId).input("val", parsed.raw).query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);
        await db.insert(schema.productMovements).values({ productId, symbol: (row as any).symbol, name: (row as any).name, toLocationId: loc.id, toCode: parsed.raw, quantity: 1, operator: "operator", correlationId: crypto.randomUUID() });
        reset++;
      }
    }
    logger.info({ location: parsed.raw, reset }, "Location reset");
    res.json({ ok: true, reset, location: parsed.raw });
  } catch (err) { logger.error({ err }, "Reset failed"); res.status(500).json({ error: "Reset nie powiodl sie" }); }
});

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
    const conditions: any[] = [eq(schema.locations.area, area)];
    if (scope === "exact" && aisle && rack && shelf) { conditions.push(eq(schema.locations.aisle, aisle)); conditions.push(eq(schema.locations.rack, rack)); conditions.push(eq(schema.locations.shelf, shelf)); }
    else if (scope === "shelf" && aisle && rack) { conditions.push(eq(schema.locations.aisle, aisle)); conditions.push(eq(schema.locations.rack, rack)); }
    else if (scope === "rack" && aisle) { conditions.push(eq(schema.locations.aisle, aisle)); }

    const rows = await db
      .select({ code: schema.locations.code, area: schema.locations.area, aisle: schema.locations.aisle, rack: schema.locations.rack, shelf: schema.locations.shelf, productId: schema.productLocations.productId, quantity: schema.productLocations.quantity })
      .from(schema.productLocations)
      .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id))
      .where(and(...conditions));
      const pr = await pool.request().query(`SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name, tw_JednMiary AS unit, tw_PodstKodKresk AS barcode FROM tw__Towar WHERE tw_Id IN (${ids})`);
      for (const p of pr.recordset) { const g = grouped.get((p as any).id); if (g) { g.symbol = (p as any).symbol; g.name = (p as any).name; g.unit = (p as any).unit; g.barcode = (p as any).barcode; } }
      const sr = await pool.request().query(`SELECT st_TowId, SUM(st_Stan) AS total FROM tw_Stan WHERE st_TowId IN (${ids}) GROUP BY st_TowId`);
      for (const s of sr.recordset) { const g = grouped.get((s as any).st_TowId); if (g) g.subiektStock = (s as any).total; }
    }
    res.json({ scope, area, aisle, rack, shelf, products: [...grouped.values()] });
  } catch (err) { logger.error({ err }, "Inventory expected failed"); res.json({ products: [] }); }
});

app.post("/api/inventory/report", async (req, res) => {
  const { scope, area, aisle, rack, shelf, scanned } = req.body ?? {};
  if (!Array.isArray(scanned)) { res.status(400).json({ error: "Brak zeskanowanych" }); return; }
  try {
    const expectedRes = await fetch(`http://localhost:3000/api/inventory/expected?scope=${scope}&area=${area}&aisle=${aisle}&rack=${rack}&shelf=${shelf}`);
    const expectedData = await expectedRes.json();
    const ep: any[] = (expectedData).products || [];
    const sm = new Map(); for (const s of scanned) { sm.set(s.code, (sm.get(s.code) || 0) + s.qty); }
    const matched = [], missing = [], extra = [], qDiff = [];
    const sc = new Set(sm.keys());
    for (const p of ep) { const sq = sm.get(p.barcode) || sm.get(p.symbol) || 0; if (sq === 0) missing.push(p); else if (sq !== p.qty) qDiff.push({ ...p, expectedQty: p.qty, scannedQty: sq }); else matched.push(p); if (p.barcode) sc.delete(p.barcode); sc.delete(p.symbol); }
    for (const c of sc) extra.push({ code: c, qty: sm.get(c) || 0 });
    try { const db = getDb(); await db.insert(schema.auditLog).values({ correlationId: crypto.randomUUID(), action: "inventory_report", details: JSON.stringify({ scope, matched: matched.length, missing: missing.length }) }); } catch {}
    res.json({ summary: { expected: ep.length, scanned: scanned.length, matched: matched.length, missing: missing.length, extra: extra.length, quantityDiff: qDiff.length }, matched, missing, extra, quantityDiff: qDiff });
  } catch (err) { logger.error({ err }, "Report failed"); res.status(500).json({ error: "Blad" }); }
});

  logger.info({ port }, "API server started");
});
