import type { Application, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { getDb, schema } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { getAdapter } from "../adapter-provider.js";
import { requireAdmin } from "../auth-middleware.js";
import { getLocationField } from "./locations.js";

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

  app.post("/api/wizard/clear", requireAdmin, async (req: Request, res: Response) => {
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

  app.post("/api/wizard/import-all", requireAdmin, async (_req: Request, res: Response) => {
    const results: any = {};
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) {
        res.status(503).json({ error: "MSSQL niedost\u0119pny" });
        return;
      }

      const locationField = await getLocationField();
      const db = getDb();

      const locResult = await pool
        .request()
        .query(
          `SELECT NULLIF(${locationField}, '') AS location FROM tw__Towar WHERE ${locationField} IS NOT NULL AND ${locationField} != '' GROUP BY ${locationField}`,
        );
      const { parseLocation } = await import("../../lib/locations.js");
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
      res.status(500).json({ error: "Import nie powi\u00f3d\u0142 si\u0119" });
    }
  });
}
