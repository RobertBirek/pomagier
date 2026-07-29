import type { Application, Request, Response } from "express";
import { getDb, schema } from "../../db/index.js";
import { getAdapter } from "../adapter-provider.js";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../auth-middleware.js";

export function registerTerminalsRoutes(app: Application): void {
  app.get("/api/terminals", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      const now = new Date();
      const rows = await db
        .select()
        .from(schema.sessions)
        .orderBy(sql`created_at DESC`)
        .limit(20);

      const terminals = rows.filter((s) => new Date(s.expiresAt) > now);

      const userNameMap = new Map<string, string>();
      if (pool) {
        const userIds = [...new Set(terminals.map((t) => t.userId))];
        const userRows = await db
          .select()
          .from(schema.users)
          .where(
            sql`${schema.users.id} IN (${userIds.map(() => sql`?`)})`,
          );
        const subiektIds = userRows.map((u) => u.subiektUzId);

        if (subiektIds.length > 0) {
          const names = await pool.request().query(`
            SELECT uz_Id AS id, uz_Imie AS firstName, uz_Nazwisko AS lastName
            FROM pd_Uzytkownik
            WHERE uz_Id IN (${subiektIds.join(",")})
          `);
          for (const row of names.recordset) {
            const r = row as { id: number; firstName: string; lastName: string };
            const subiektId = r.id;
            const appUser = userRows.find((u) => u.subiektUzId === subiektId);
            if (appUser) {
              userNameMap.set(appUser.id, `${r.firstName || ""} ${r.lastName || ""}`.trim());
            }
          }
        }
      }

      res.json(
        terminals.map((s) => ({
          id: s.id,
          userId: s.userId,
          userName: userNameMap.get(s.userId) || "",
          loginTime: s.createdAt,
          expiresAt: s.expiresAt,
        })),
      );
    } catch {
      res.json([]);
    }
  });
}
