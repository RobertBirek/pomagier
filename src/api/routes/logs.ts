import type { Application, Request, Response } from "express";
import { z } from "zod";
import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "../../db/index.js";
import { requireAdmin } from "../auth-middleware.js";
import { logger } from "../../lib/logger.js";

const QuerySchema = z.object({
  category: z.string().optional(),
  action: z.string().optional(),
  user: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  method: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  correlation: z.string().optional(),
  page: z.string().optional().default("1"),
  pageSize: z.string().optional().default("50"),
});

type LogQuery = z.infer<typeof QuerySchema>;

function parseQuery(req: Request): LogQuery {
  const parsed = QuerySchema.safeParse(req.query);
  if (parsed.success) return parsed.data;
  return {
    page: "1",
    pageSize: "50",
  };
}

function buildConditions(q: LogQuery) {
  const conds = [];
  if (q.category) {
    const cats = q.category.split(",").filter(Boolean);
    if (cats.length === 1) conds.push(eq(schema.auditLog.category, cats[0]));
    else if (cats.length > 1) conds.push(or(...cats.map((c) => eq(schema.auditLog.category, c))));
  }
  if (q.method) {
    const methods = q.method.split(",").filter(Boolean);
    if (methods.length === 1) conds.push(eq(schema.auditLog.method, methods[0]));
    else if (methods.length > 1)
      conds.push(or(...methods.map((m) => eq(schema.auditLog.method, m))));
  }
  if (q.user) {
    const uid = parseInt(q.user, 10);
    if (!Number.isNaN(uid)) conds.push(eq(schema.auditLog.actorSubiektUzId, uid));
  }
  if (q.targetType) conds.push(eq(schema.auditLog.targetType, q.targetType));
  if (q.targetId) conds.push(eq(schema.auditLog.targetId, q.targetId));
  if (q.action) conds.push(eq(schema.auditLog.action, q.action));
  if (q.from) {
    const from = new Date(q.from);
    if (!Number.isNaN(from.getTime())) conds.push(gte(schema.auditLog.createdAt, from));
  }
  if (q.to) {
    const to = new Date(q.to);
    if (!Number.isNaN(to.getTime())) conds.push(lte(schema.auditLog.createdAt, to));
  }
  if (q.q) {
    const pattern = `%${q.q}%`;
    conds.push(
      or(
        like(schema.auditLog.action, pattern),
        like(schema.auditLog.details, pattern),
        like(schema.auditLog.targetId, pattern),
      ),
    );
  }
  if (q.correlation) conds.push(eq(schema.auditLog.correlationId, q.correlation));
  return conds.length > 0 ? and(...conds) : undefined;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  if (/^[=+\-@]/.test(s)) {
    return `"\t${s}"`;
  }
  return /[,"\n]/.test(s) ? `"${s}"` : s;
}

const CSV_HEADERS = [
  "id",
  "created_at",
  "category",
  "method",
  "action",
  "actor_subiekt_uz_id",
  "user_id",
  "target_type",
  "target_id",
  "correlation_id",
  "details",
];

export function registerLogsRoutes(app: Application): void {
  app.get("/api/logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const q = parseQuery(req);
      const page = Math.max(1, parseInt(q.page, 10) || 1);
      const pageSize = Math.min(200, Math.max(10, parseInt(q.pageSize, 10) || 50));
      const offset = (page - 1) * pageSize;
      const conds = buildConditions(q);

      const whereClause = conds ?? sql`1=1`;
      const rows = await db
        .select()
        .from(schema.auditLog)
        .where(whereClause)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(pageSize)
        .offset(offset);

      const [countRow] = await db
        .select({ cnt: sql<number>`COUNT(*)::int` })
        .from(schema.auditLog)
        .where(whereClause);
      const total = countRow?.cnt ?? 0;

      const byCategory: Record<string, number> = {};
      const byMethod: Record<string, number> = {};
      for (const r of rows) {
        if (r.category) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
        if (r.method) byMethod[r.method] = (byMethod[r.method] ?? 0) + 1;
      }

      res.json({ rows, total, page, pageSize, stats: { byCategory, byMethod } });
    } catch (err) {
      logger.error({ err }, "Logs list failed");
      res.json({ rows: [], total: 0, page: 1, pageSize: 50, stats: {} });
    }
  });

  app.get("/api/logs/users", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const rows = await db
        .selectDistinct({ actorSubiektUzId: schema.auditLog.actorSubiektUzId })
        .from(schema.auditLog)
        .where(sql`${schema.auditLog.actorSubiektUzId} IS NOT NULL`)
        .orderBy(schema.auditLog.actorSubiektUzId);
      const users = rows.map((r) => r.actorSubiektUzId);
      res.json({ users });
    } catch (err) {
      logger.error({ err }, "Logs users list failed");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/logs/export.csv", requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const q = parseQuery(req);
      const conds = buildConditions(q);
      const whereClause = conds ?? sql`1=1`;
      const rows = await db
        .select()
        .from(schema.auditLog)
        .where(whereClause)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(10000);

      const lines = [
        CSV_HEADERS.join(","),
        ...rows.map((r) =>
          CSV_HEADERS.map((h) => {
            const key = h.replace(/_([a-z])/g, (_match, c: string) => c.toUpperCase());
            return csvEscape((r as Record<string, unknown>)[key]);
          }).join(","),
        ),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(lines.join("\n"));
    } catch (err) {
      logger.error({ err }, "CSV export failed");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/logs/export.json", requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const q = parseQuery(req);
      const conds = buildConditions(q);
      const whereClause = conds ?? sql`1=1`;
      const rows = await db
        .select()
        .from(schema.auditLog)
        .where(whereClause)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(10000);
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="logs-${new Date().toISOString().slice(0, 10)}.json"`,
      );
      res.json({ rows, exportedAt: new Date().toISOString() });
    } catch (err) {
      logger.error({ err }, "JSON export failed");
      res.status(500).json({ error: "Internal error" });
    }
  });

  app.get("/api/logs/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const id = req.params.id as string;
      const [entry] = await db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.id, id))
        .limit(1);
      if (!entry) {
        res.status(404).json({ error: "Log entry not found" });
        return;
      }
      let related: (typeof entry)[] = [];
      if (entry.correlationId) {
        const all = await db
          .select()
          .from(schema.auditLog)
          .where(eq(schema.auditLog.correlationId, entry.correlationId));
        related = all.filter((r) => r.id !== id);
      }
      res.json({ entry, related });
    } catch (err) {
      logger.error({ err }, "Log detail failed");
      res.status(500).json({ error: "Internal error" });
    }
  });
}
