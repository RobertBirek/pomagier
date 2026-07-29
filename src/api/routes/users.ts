import type { Application, Request, Response } from "express";
import { getAdapter } from "../adapter-provider.js";
import { getDb, schema } from "../../db/index.js";
import { logger } from "../../lib/logger.js";
import type { UserRow, WarehouseRow } from "../types.js";

export function registerUsersRoutes(app: Application): void {
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

  app.get("/api/warehouses", async (_req: Request, res: Response) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) {
        res.json([]);
        return;
      }

      const result = await pool.request().query(`
        SELECT mag_Id AS id, mag_Symbol AS symbol, mag_Nazwa AS name, mag_Glowny AS isMain
        FROM sl_Magazyn
        ORDER BY mag_Id
      `);
      res.json(result.recordset as WarehouseRow[]);
    } catch {
      res.json([]);
    }
  });
}
