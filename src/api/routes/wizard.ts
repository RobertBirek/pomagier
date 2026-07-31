import type { Application, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { getDb, schema } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { getAdapter } from "../adapter-provider.js";
import { getLocationField } from "./locations.js";

interface SubiektLocationRow {
  location: string;
}
interface SubiektProductLocRow {
  productId: number;
  locRaw: string;
}
interface SubiektUserIdRow {
  id: number;
}

interface WizardResults {
  locations?: { imported: number; skipped: number };
  productLocations?: { inserted: number; skipped: number };
  users?: { seeded: number; updated: number; pins: { subiektUzId: number; pin: string }[] };
}

/** Parse ?skip=locations,productLocations query param into a Set. */
function parseSkip(req: Request): Set<string> {
  return new Set(
    String(req.query.skip || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function registerWizardRoutes(app: Application): void {
  app.get("/api/wizard/status", async (_req: Request, res: Response) => {
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

  // POST /api/wizard/clear — publiczny (setup flow, endpoint w PUBLIC_PATHS)
  // Zdejmujemy requireAdmin — wizard jest jednorazową stroną setupu.
  app.post("/api/wizard/clear", async (req: Request, res: Response) => {
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
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/wizard/import-all
  //   - publiczny (setup flow)
  //   - opcjonalny query param ?skip=locations,productLocations pomija wybrane kroki
  //   - sekcja user ZAWSZE seeduje (default PIN "0000" dla onboardingu w LAN)
  //   - onConflictDoUpdate dla userów: aktualizuje istniejących do PIN 0000
  app.post("/api/wizard/import-all", async (req: Request, res: Response) => {
    const skip = parseSkip(req);
    const results: WizardResults = {};
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) {
        res.status(503).json({ error: "MSSQL niedost\u0119pny" });
        return;
      }

      const db = getDb();
      const { parseLocation } = await import("../../lib/locations.js");
      const locationField = await getLocationField();

      // 1) Lokalizacje (pomijalne przez ?skip=locations)
      if (!skip.has("locations")) {
        const locResult = await pool
          .request()
          .query(
            `SELECT NULLIF(${locationField}, '') AS location FROM tw__Towar WHERE ${locationField} IS NOT NULL AND ${locationField} != '' GROUP BY ${locationField}`,
          );
        let imported = 0,
          skipped = 0;
        for (const row of locResult.recordset) {
          const parts = (row as SubiektLocationRow).location
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
      }

      // 2) Product locations (pomijalne przez ?skip=productLocations)
      if (!skip.has("productLocations")) {
        const allLocs = await db.select().from(schema.locations);
        const allProducts = await pool
          .request()
          .query(
            `SELECT tw_Id AS productId, NULLIF(${locationField}, '') AS locRaw FROM tw__Towar WHERE ${locationField} IS NOT NULL AND ${locationField} != ''`,
          );
        let plInserted = 0,
          plSkipped = 0;

        await db.transaction(async (tx) => {
          await tx.delete(schema.productLocations);
          for (const row of allProducts.recordset) {
            const productId = (row as SubiektProductLocRow).productId;
            const parts = (row as SubiektProductLocRow).locRaw
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
                await tx
                  .insert(schema.productLocations)
                  .values({ productId, locationId: loc.id, quantity: 1 })
                  .onConflictDoNothing();
                plInserted++;
              } catch {
                plSkipped++;
              }
            }
          }
        });
        results.productLocations = { inserted: plInserted, skipped: plSkipped };
      }

      // 3) Users — ZAWSZE wykonywane (nawet przy skip powyżej)
      //    Default PIN "0000" dla wszystkich (świadoma decyzja dla LAN onboardingu).
      //    onConflictDoUpdate: aktualizuje PIN istniejących do "0000" (idempotentne).
      const userResult = await pool
        .request()
        .query("SELECT uz_Id AS id FROM pd_Uzytkownik WHERE uz_Status = 1");
      let usersSeeded = 0;
      let usersUpdated = 0;
      const seededPins: { subiektUzId: number; pin: string }[] = [];
      const rawPin = "0000";
      const hashedPin = bcrypt.hashSync(rawPin, 10);
      for (const row of userResult.recordset) {
        const subiektUzId = (row as SubiektUserIdRow).id;
        const [existing] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.subiektUzId, subiektUzId));
        if (existing) {
          await db
            .update(schema.users)
            .set({ pin: hashedPin, active: true })
            .where(eq(schema.users.subiektUzId, subiektUzId));
          usersUpdated++;
        } else {
          await db.insert(schema.users).values({
            subiektUzId,
            pin: hashedPin,
            role: subiektUzId === 1 ? "admin" : "operator",
          });
          usersSeeded++;
        }
        seededPins.push({ subiektUzId, pin: rawPin });
      }
      logger.info(
        { usersSeeded, usersUpdated, totalPins: seededPins.length },
        "Users seeded/updated with default PIN 0000",
      );
      results.users = { seeded: usersSeeded, updated: usersUpdated, pins: seededPins };

      res.json({ ok: true, results });
    } catch (err) {
      logger.error({ err }, "Import all failed");
      res.status(500).json({ error: "Import nie powi\u00f3d\u0142 si\u0119" });
    }
  });
}
