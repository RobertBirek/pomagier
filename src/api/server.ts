import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { MssqlErpAdapter } from "../erp/mssql.adapter.ts";
import { MockErpAdapter } from "../erp/mock.adapter.ts";
import type { ErpAdapter } from "../erp/adapter.ts";
import { getDb, schema } from "../db/index.ts";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.ts";

const app = express();
app.use(cors());
app.use(express.json());

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
      street: row?.street ? `${row.street} ${row.houseNo || ""}${row.aptNo ? `/${row.aptNo}` : ""}` : "",
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
      res.status(401).json({ error: "Użytkownik nie skonfigurowany w PomagierGT" });
      return;
    }

    if (user.pin !== hashPin(pin)) {
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
    res.status(422).json({ error: "Invalid code", found: false, barcode: code ?? "", products: [] });
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
    res.status(400).json({ ok: false, error: "Brak wymaganych parametrów (host, database, user, password)" });
    return;
  }
  try {
    const { MssqlErpAdapter } = await import("../erp/mssql.adapter.ts");
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
    const storedPwd = password && password !== "••••••••"
      ? password
      : (await db.select().from(schema.config).where(eq(schema.config.key, "mssql_password")))[0]?.value || process.env.MSSQL_PASSWORD || "";
    await adapter.reconnect?.({ host, port: parseInt(String(port)) || 1433, database, user, password: storedPwd });

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
    const { sortLocations } = await import("../lib/locations.ts");
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

    const { parseLocation } = await import("../lib/locations.ts");
    const db = getDb();

    // Normalize existing entries (fix missing spaces)
    const existing = await db.select().from(schema.locations);
    for (const loc of existing) {
      const parsed = parseLocation(loc.code);
      if (parsed && parsed.raw !== loc.code) {
        // Delete old malformed, insert corrected
        await db.delete(schema.locations).where(eq(schema.locations.id, loc.id));
        try {
          await db.insert(schema.locations).values({
            code: parsed.raw, area: parsed.area, aisle: parsed.aisle,
            rack: parsed.rack, shelf: parsed.shelf, spot: parsed.spot, label: parsed.label,
          }).onConflictDoNothing();
        } catch { /* skip if already exists */ }
      }
    }

    let imported = 0;
    let skipped = 0;

    for (const row of result.recordset) {
      const raw = (row as any).location as string;
      // Obsługa wielu lokalizacji oddzielonych średnikiem
      const parts = raw.split(";").map((s: string) => s.trim()).filter(Boolean);
      for (const part of parts) {
        const parsed = parseLocation(part);
        if (!parsed) { skipped++; continue; }
        try {
          await db.insert(schema.locations).values({
            code: parsed.raw,
            area: parsed.area,
            aisle: parsed.aisle,
            rack: parsed.rack,
            shelf: parsed.shelf,
            spot: parsed.spot,
            label: parsed.label,
          }).onConflictDoNothing();
          imported++;
        } catch { skipped++; }
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

  const { parseLocation } = await import("../lib/locations.ts");
  const parsed = parseLocation(code);
  if (!parsed) {
    res.status(422).json({ error: "Nieprawidłowy format lokalizacji. Oczekiwano: A 1-2-3-4" });
    return;
  }

  try {
    const db = getDb();

    // Sprawdź duplikat
    const [existing] = await db.select().from(schema.locations).where(eq(schema.locations.code, parsed.raw));
    if (existing) {
      res.status(409).json({ error: "Lokalizacja już istnieje", location: existing });
      return;
    }

    const [created] = await db.insert(schema.locations).values({
      code: parsed.raw,
      area: parsed.area,
      aisle: parsed.aisle,
      rack: parsed.rack,
      shelf: parsed.shelf,
      spot: parsed.spot,
      label: parsed.label,
    }).returning();

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

    const result = await pool
      .request()
      .input("location", location)
      .query(`
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

  const { parseLocation } = await import("../lib/locations.ts");
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
    const current = await pool.request()
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

    await pool.request()
      .input("id", parseInt(productId as any))
      .input("val", newValue)
      .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);

    logger.info({ productId, location: parsed.raw, field: locationField, value: newValue }, "Product location updated in Subiekt");
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
    const search = (req.query.search as string || "").trim();
    const warehouseId = parseInt(req.query.warehouseId as string) || 0;
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE 1=1";
    const params: { name: string; value: any }[] = [];

    if (search) {
      whereClause += " AND (t.tw_Symbol LIKE @search OR t.tw_Nazwa LIKE @search OR t.tw_PodstKodKresk LIKE @search)";
      params.push({ name: "search", value: `%${search}%` });
    }

    const countQuery = `SELECT COUNT(*) AS total FROM tw__Towar t ${whereClause}`;
    const dataQuery = `
      SELECT
        t.tw_Id AS id, t.tw_Symbol AS symbol, t.tw_Nazwa AS name,
        t.tw_PodstKodKresk AS barcode, t.tw_JednMiary AS unit,
        t.tw_Opis AS description, t.tw_Pole1 AS location,
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

    res.json({
      rows: dataResult.recordset,
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
    const rows = await db.select().from(schema.config).where(sql`${schema.config.key} LIKE 'fieldmap_%'`);
    const { DEFAULT_MAPPINGS } = await import("../lib/field-mappings.ts");

    const map = new Map(rows.map((r) => [r.key.replace("fieldmap_", ""), r.value]));
    const result = DEFAULT_MAPPINGS.map((dm) => ({
      ...dm,
      subiektField: map.get(dm.key) || dm.subiektField,
    }));
    res.json(result);
  } catch {
    const { DEFAULT_MAPPINGS } = await import("../lib/field-mappings.ts");
    res.json(DEFAULT_MAPPINGS);
  }
});

app.put("/api/field-mappings", async (req, res) => {
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

const port = parseInt(process.env.API_PORT ?? "3001", 10);
app.listen(port, () => {
  logger.info({ port }, "API server started");
});
