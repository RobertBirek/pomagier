import type { Application, Request, Response } from "express";
import { getAdapter } from "../adapter-provider.js";
import { getDb, schema } from "../../db/index.js";
import { logger } from "../../lib/logger.js";
import type { UserRow } from "../types.js";
import { resolveSupportedWarehouses } from "./erp-supported-warehouses.js";

export function registerUsersRoutes(app: Application): void {
  // GET /api/users — public (used by login pages)
  app.get("/api/users", async (_req: Request, res: Response) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) {
        res.json([]);
        return;
      }

      const result = await pool.request().query(`
        SELECT uz_Id AS id, uz_Imie AS firstName, uz_Nazwisko AS lastName, uz_Status AS active
        FROM pd_Uzytkownik
        ORDER BY uz_Id
      `);

      const db = getDb();
      const appUsers = await db.select().from(schema.users);

      const users = (result.recordset as UserRow[]).map((u) => {
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

  // GET /api/warehouses — public; returns only globally supported warehouses
  // (auto-defaults to isMain warehouse if config is empty)
  app.get("/api/warehouses", async (_req: Request, res: Response) => {
    try {
      const { fetchAllWarehouses } = await import("./erp-supported-warehouses.js");
      const all = await fetchAllWarehouses();
      if (all.length === 0) {
        res.json([]);
        return;
      }
      const { ids, appliedDefault } = await resolveSupportedWarehouses();
      const supportedSet = new Set(ids);
      const filtered = all.filter((w) => supportedSet.has(w.id));
      if (appliedDefault) {
        logger.info(
          { defaultCount: filtered.length, appliedDefault: true },
          "Supported warehouses auto-defaulted to isMain",
        );
      }
      res.json(filtered);
    } catch (err) {
      logger.error({ err }, "Failed to fetch warehouses");
      res.json([]);
    }
  });
}
