import type { Application, Request, Response } from "express";
import { getAdapter } from "../adapter-provider.js";
import { logger } from "../../lib/logger.js";
import { requireAuth } from "../auth-middleware.js";
import type { StatRow } from "../types.js";

export function registerStatsRoutes(app: Application): void {
  app.get("/api/stats", requireAuth, async (_req: Request, res: Response) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) {
        res.json({ products: 0, warehouses: 0, users: 0 });
        return;
      }

      const [p, w, u] = await Promise.all([
        pool.request().query("SELECT COUNT(*) AS cnt FROM tw__Towar"),
        pool.request().query("SELECT COUNT(*) AS cnt FROM sl_Magazyn"),
        pool.request().query("SELECT COUNT(*) AS cnt FROM pd_Uzytkownik WHERE uz_Status = 1"),
      ]);

      res.json({
        products: (p.recordset[0] as StatRow).cnt,
        warehouses: (w.recordset[0] as StatRow).cnt,
        users: (u.recordset[0] as StatRow).cnt,
      });
    } catch (err) {
      logger.error({ err }, "Stats query failed");
      res.json({ products: 0, warehouses: 0, users: 0 });
    }
  });
}
