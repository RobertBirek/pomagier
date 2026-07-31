import type { Application, Request, Response } from "express";
import { getDb, schema } from "../../db/index.js";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { requireAdmin } from "../auth-middleware.js";

export function registerActivityRoutes(app: Application): void {
  app.get("/api/activity", requireAdmin, async (_req: Request, res: Response) => {
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
    } catch (err) {
      logger.error({ err }, "Activity query failed");
      res.json({ movements: [], scans: [], dailyStats: [] });
    }
  });

  app.get("/api/logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(10, parseInt(req.query.pageSize as string) || 50));
      const offset = (page - 1) * pageSize;

      const movements = await db
        .select()
        .from(schema.productMovements)
        .orderBy(sql`${schema.productMovements.createdAt} DESC`)
        .limit(pageSize)
        .offset(offset);
      const [movCount] = await db
        .select({ cnt: sql<number>`COUNT(*)::int` })
        .from(schema.productMovements);

      const audits = await db
        .select()
        .from(schema.auditLog)
        .orderBy(sql`${schema.auditLog.createdAt} DESC`)
        .limit(pageSize);
      const [audCount] = await db.select({ cnt: sql<number>`COUNT(*)::int` }).from(schema.auditLog);

      const rows = [
        ...movements.map((m) => ({
          id: m.id,
          type: "movement",
          productId: m.productId,
          symbol: m.symbol,
          name: m.name,
          fromCode: m.fromCode,
          toCode: m.toCode,
          quantity: m.quantity,
          operator: m.operator,
          correlationId: m.correlationId,
          createdAt: m.createdAt,
        })),
        ...audits.map((a) => ({
          id: a.id,
          type: "audit",
          action: a.action,
          details: a.details,
          correlationId: a.correlationId,
          userId: a.userId,
          createdAt: a.createdAt,
        })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, pageSize);

      res.json({ rows, total: (movCount?.cnt || 0) + (audCount?.cnt || 0), page, pageSize });
    } catch (err) {
      logger.error({ err }, "Logs failed");
      res.json({ rows: [], total: 0, page: 1, pageSize: 50 });
    }
  });
}
