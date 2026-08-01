import type { Application, Request, Response } from "express";
import { getDb, schema } from "../../db/index.js";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { logEvent } from "../../lib/app-logger.js";
import { requireAdmin } from "../auth-middleware.js";

export function registerActivityRoutes(app: Application): void {
  app.get("/api/activity", requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const movements = await db
        .select()
        .from(schema.productMovements)
        .orderBy(sql`${schema.productMovements.createdAt} DESC`)
        .limit(20);

      const scans = movements.slice(0, 10);

      const dailyStats: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(dayStart.getTime() + 86400000);

        const [result] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(schema.productMovements)
          .where(
            sql`${schema.productMovements.createdAt} >= ${dayStart.toISOString()} AND ${schema.productMovements.createdAt} < ${dayEnd.toISOString()}`,
          );

        dailyStats.push({ date: d.toISOString().slice(0, 10), count: result?.count || 0 });
      }

      res.json({ movements, scans: scans.slice(0, 10), dailyStats });
      await logEvent({
        category: "admin",
        action: "activity.viewed",
        method: "web",
        actorUserId: req.user?.id,
        target: { type: "activity", id: "dashboard" },
        success: true,
      });
    } catch (err) {
      logger.error({ err }, "Activity query failed");
      await logEvent({
        category: "admin",
        action: "activity.viewed",
        method: "web",
        actorUserId: req.user?.id,
        target: { type: "activity", id: "dashboard" },
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      res.json({ movements: [], scans: [], dailyStats: [] });
    }
  });
}
