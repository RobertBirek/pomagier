import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import { MssqlErpAdapter } from "../erp/mssql.adapter.ts";
import { MockErpAdapter } from "../erp/mock.adapter.ts";
import type { ErpAdapter } from "../erp/adapter.ts";
import { getDb, schema } from "../db/index.ts";
import { eq, and } from "drizzle-orm";
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
      return res.json({ name: "PomagierGT (demo)", nip: "", regon: "" });
    }
    const result = await pool.request().query(`
      SELECT TOP 1 pd_LicNazwaFirmy AS name, pd_LicNIP AS nip, pd_Regon AS regon
      FROM pd__Podmiot
    `);
    const row = result.recordset[0];
    res.json({ name: row?.name || "(bez nazwy)", nip: row?.nip || "", regon: row?.regon || "" });
  } catch {
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

const port = parseInt(process.env.API_PORT ?? "3001", 10);
app.listen(port, () => {
  logger.info({ port }, "API server started");
});
