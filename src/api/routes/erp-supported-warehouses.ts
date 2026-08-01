import type { Application, Request, Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getAdapter } from "../adapter-provider.js";
import { getDb, schema } from "../../db/index.js";
import { logger } from "../../lib/logger.js";
import { requireAdmin } from "../auth-middleware.js";
import { validate } from "../validation.js";
import type { WarehouseRow } from "../types.js";

const PutSchema = z.object({
  warehouseIds: z.array(z.number().int().positive()),
});

interface CacheEntry {
  value: number[] | null;
  ts: number;
}
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000;

function invalidateCache(): void {
  cache = null;
}

/** Test helper: reset in-memory cache. */
export function _resetCacheForTests(): void {
  cache = null;
}

/**
 * Read supported warehouse IDs from config.
 * Returns:
 *   - array of IDs if explicitly set in config
 *   - null if not configured (caller should apply default: isMain warehouse)
 */
export async function getSupportedWarehouseIds(): Promise<number[] | null> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return cache.value;
  }
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.config)
      .where(eq(schema.config.key, "supported_warehouses"));
    if (!row?.value) {
      cache = { value: null, ts: Date.now() };
      return null;
    }
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) {
      cache = { value: null, ts: Date.now() };
      return null;
    }
    const ids = parsed.filter(
      (n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0,
    );
    cache = { value: ids, ts: Date.now() };
    return ids;
  } catch (err) {
    logger.warn({ err }, "Failed to read supported_warehouses from config");
    cache = { value: null, ts: Date.now() };
    return null;
  }
}

/** Fetch all warehouses from Subiekt (no filter). */
export async function fetchAllWarehouses(): Promise<WarehouseRow[]> {
  const adapter = getAdapter();
  const pool = await adapter.getPool?.();
  if (!pool) return [];
  const result = await pool.request().query(`
    SELECT mag_Id AS id, mag_Symbol AS symbol, mag_Nazwa AS name, mag_Glowny AS isMain
    FROM sl_Magazyn
    ORDER BY mag_Id
  `);
  return (result.recordset as WarehouseRow[]).map((w) => ({
    ...w,
    isMain: Boolean(w.isMain),
  }));
}

/**
 * Resolve the actual list of supported warehouse IDs to show in UI / use in scan.
 * Applies auto-default (isMain warehouse) when config is empty.
 */
export async function resolveSupportedWarehouses(): Promise<{
  ids: number[];
  appliedDefault: boolean;
}> {
  const configured = await getSupportedWarehouseIds();
  if (configured !== null) {
    return { ids: configured, appliedDefault: false };
  }
  // Empty config → auto-default
  const all = await fetchAllWarehouses();
  const main = all.find((w) => w.isMain);
  if (!main) {
    logger.warn(
      "supported_warehouses not configured and no isMain warehouse in Subiekt — list is empty",
    );
    return { ids: [], appliedDefault: true };
  }
  return { ids: [main.id], appliedDefault: true };
}

export function registerErpSupportedWarehousesRoutes(app: Application): void {
  // GET /api/erp/supported-warehouses — admin: all warehouses + list of supported IDs
  app.get("/api/erp/supported-warehouses", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const all = await fetchAllWarehouses();
      const configured = await getSupportedWarehouseIds();
      res.json({
        all,
        supportedIds: configured ?? [],
        configured: configured !== null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Błąd";
      logger.error({ err }, "GET /api/erp/supported-warehouses failed");
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/erp/supported-warehouses — admin: set list of supported IDs
  app.put(
    "/api/erp/supported-warehouses",
    requireAdmin,
    validate(PutSchema),
    async (req: Request, res: Response) => {
      try {
        const { warehouseIds } = req.body as { warehouseIds: number[] };
        const all = await fetchAllWarehouses();
        const allIds = new Set(all.map((w) => w.id));
        for (const id of warehouseIds) {
          if (!allIds.has(id)) {
            res.status(400).json({ error: `Magazyn ${id} nie istnieje w Subiekcie` });
            return;
          }
        }
        const db = getDb();
        const json = JSON.stringify(warehouseIds);
        await db
          .insert(schema.config)
          .values({ key: "supported_warehouses", value: json, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: schema.config.key,
            set: { value: json, updatedAt: new Date() },
          });
        invalidateCache();
        logger.info({ warehouseIds }, "Supported warehouses updated");
        res.json({ ok: true, supportedIds: warehouseIds });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Błąd";
        logger.error({ err }, "PUT /api/erp/supported-warehouses failed");
        res.status(500).json({ error: message });
      }
    },
  );
}
