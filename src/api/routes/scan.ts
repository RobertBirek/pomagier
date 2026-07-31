import type { Application, Request, Response } from "express";
import { z } from "zod";
import { eq, or, sql } from "drizzle-orm";
import { getAdapter } from "../adapter-provider.js";
import { getDb, schema } from "../../db/index.js";
import { parseLocation } from "../../lib/locations.js";
import { logger } from "../../lib/logger.js";
import { validate } from "../validation.js";

const ScanSchema = z.object({
  code: z.string().min(1).max(50),
});

interface ProductsCacheRow {
  id: number;
  symbol: string;
  name: string;
  barcode: string;
  unit: string;
}

interface MssqlQuickRow {
  tw_Id: number;
  tw_Symbol: string;
  tw_Nazwa: string;
  tw_PodstKodKresk: string;
  tw_JednMiary: string;
}

async function lookupProductInCache(code: string): Promise<ProductsCacheRow | null> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.productsCache)
      .where(or(eq(schema.productsCache.barcode, code), eq(schema.productsCache.symbol, code)))
      .limit(1);
    return (rows[0] as ProductsCacheRow) ?? null;
  } catch {
    return null;
  }
}

async function lookupProductInMssql(code: string): Promise<ProductsCacheRow | null> {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return null;

    // Quick query: tw__Towar only, no stock joins
    const result = await pool.request().input("code", code).query(`
      SELECT tw_Id, tw_Symbol, tw_Nazwa, tw_PodstKodKresk, tw_JednMiary
      FROM tw__Towar
      WHERE tw_PodstKodKresk = @code OR tw_Symbol = @code
    `);

    if (result.recordset.length > 0) {
      const row = result.recordset[0] as MssqlQuickRow;
      return {
        id: row.tw_Id,
        symbol: row.tw_Symbol,
        name: row.tw_Nazwa,
        barcode: row.tw_PodstKodKresk || "",
        unit: row.tw_JednMiary || "szt",
      };
    }

    // Try sync barcode table
    const syncResult = await pool.request().input("code", code).query(`
      SELECT TOP 1 usk_IdSynchronizacja
      FROM uf_SynchroKodyKresk
      WHERE usk_Kod = @code
    `);
    if (syncResult.recordset.length > 0) {
      const syncId = (syncResult.recordset[0] as { usk_IdSynchronizacja: number })
        .usk_IdSynchronizacja;
      const r2 = await pool.request().input("id", syncId).query(`
        SELECT tw_Id, tw_Symbol, tw_Nazwa, tw_PodstKodKresk, tw_JednMiary
        FROM tw__Towar WHERE tw_Id = @id
      `);
      if (r2.recordset.length > 0) {
        const row2 = r2.recordset[0] as MssqlQuickRow;
        return {
          id: row2.tw_Id,
          symbol: row2.tw_Symbol,
          name: row2.tw_Nazwa,
          barcode: row2.tw_PodstKodKresk || "",
          unit: row2.tw_JednMiary || "szt",
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function cacheProduct(row: ProductsCacheRow): Promise<void> {
  try {
    const db = getDb();
    await db
      .insert(schema.productsCache)
      .values({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        barcode: row.barcode || null,
        unit: row.unit || "szt",
      })
      .onConflictDoUpdate({
        target: schema.productsCache.id,
        set: {
          symbol: row.symbol,
          name: row.name,
          barcode: row.barcode || null,
          unit: row.unit || "szt",
          updatedAt: sql`now()`,
        },
      });
  } catch {
    // cache write failure is non-critical
  }
}

async function getProductLocations(productId: number): Promise<{ code: string }[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({ code: schema.locations.code })
      .from(schema.productLocations)
      .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id))
      .where(eq(schema.productLocations.productId, productId));
    return rows.map((r) => ({ code: r.code }));
  } catch {
    return [];
  }
}

export function registerScanRoutes(app: Application): void {
  // Existing scan endpoint (full MSSQL with stocks)
  app.post("/api/scan", validate(ScanSchema), async (req: Request, res: Response) => {
    const { code } = req.body;

    try {
      if (req.user?.role !== "admin" && !req.user?.warehouseId) {
        res.status(403).json({
          error: "Operator nie ma przypisanego magazynu",
          found: false,
          barcode: code,
          products: [],
        });
        return;
      }
      const adapter = getAdapter();
      const result = await adapter.scan(code.trim(), req.user?.warehouseId);
      logger.info({ code: code.trim(), found: result.found }, "Scan completed");
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "ERP error";
      logger.error({ err, code }, "Scan failed");
      res.status(502).json({ error: message, found: false, barcode: code, products: [] });
    }
  });

  // Fast scan-basket endpoint (Postgres-first, MSSQL fallback, no stock joins)
  app.post("/api/scan-basket", validate(ScanSchema), async (req: Request, res: Response) => {
    const code = req.body.code.trim();

    try {
      // 1. Location check (regex-based, fast)
      const parsed = parseLocation(code);
      if (parsed) {
        const db = getDb();
        const [loc] = await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.code, parsed.raw))
          .limit(1);

        let productCount = 0;
        if (loc) {
          const [countRow] = await db
            .select({ cnt: sql<number>`count(*)::int` })
            .from(schema.productLocations)
            .where(eq(schema.productLocations.locationId, loc.id));
          productCount = countRow?.cnt ?? 0;
        }

        logger.info({ code, type: "location", productCount }, "Scan-basket location");
        res.json({
          type: "location",
          code: parsed.raw,
          productCount,
        });
        return;
      }

      // 2. Check products_cache (Postgres)
      let cached = await lookupProductInCache(code);

      // 3. MSSQL fallback
      if (!cached) {
        cached = await lookupProductInMssql(code);
        if (cached) {
          await cacheProduct(cached);
        }
      }

      if (cached) {
        const locations = await getProductLocations(cached.id);
        logger.info({ code, type: "product", symbol: cached.symbol }, "Scan-basket product");
        res.json({
          type: "product",
          code,
          productId: cached.id,
          symbol: cached.symbol,
          name: cached.name,
          barcode: cached.barcode || code,
          unit: cached.unit || "szt",
          locations,
        });
        return;
      }

      // 4. Not found
      logger.info({ code, type: "not_found" }, "Scan-basket not found");
      res.json({ type: "not_found", code });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Scan-basket error";
      logger.error({ err, code }, "Scan-basket failed");
      res.status(502).json({ type: "not_found", code, error: message });
    }
  });
}
