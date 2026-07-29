import type { Application, Request, Response } from "express";
import { z } from "zod";
import { getAdapter } from "../adapter-provider.js";
import { getDb, schema } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { requireAdmin } from "../auth-middleware.js";
import { validate } from "../validation.js";

const ErpConfigSaveSchema = z.object({
  host: z.string().min(1),
  port: z.union([z.string(), z.number()]).optional(),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().optional(),
});

const TestConnectionSchema = z.object({
  host: z.string().min(1),
  port: z.union([z.string(), z.number()]).optional(),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
});

export function registerErpConfigRoutes(app: Application): void {
  app.get("/api/erp-config", async (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const rows = await db.select().from(schema.config);
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      res.json({
        host: map.mssql_host || process.env.MSSQL_HOST || "",
        port: parseInt(map.mssql_port) || parseInt(process.env.MSSQL_PORT || "1433"),
        database: map.mssql_database || process.env.MSSQL_DATABASE || "",
        user: map.mssql_user || process.env.MSSQL_USER || "",
        password: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      });
    } catch {
      res.json({
        host: process.env.MSSQL_HOST || "",
        port: parseInt(process.env.MSSQL_PORT || "1433"),
        database: process.env.MSSQL_DATABASE || "",
        user: process.env.MSSQL_USER || "",
        password: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
      });
    }
  });

  app.post("/api/erp-config", validate(ErpConfigSaveSchema), async (req: Request, res: Response) => {
    const { host, port, database, user, password } = req.body;
    try {
      const db = getDb();
      const entries = [
        { key: "mssql_host", value: host },
        { key: "mssql_port", value: String(port || 1433) },
        { key: "mssql_database", value: database },
        { key: "mssql_user", value: user },
      ];
      if (password && password !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
        entries.push({ key: "mssql_password", value: password });
      }
      for (const e of entries) {
        await db
          .insert(schema.config)
          .values({ key: e.key, value: e.value })
          .onConflictDoUpdate({ target: schema.config.key, set: { value: e.value } });
      }

      const adapter = getAdapter();
      const storedPwd =
        password && password !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
          ? password
          : (
              await db
                .select()
                .from(schema.config)
                .where(eq(schema.config.key, "mssql_password"))
            )[0]?.value || process.env.MSSQL_PASSWORD || "";
      await adapter.reconnect?.({
        host,
        port: parseInt(String(port)) || 1433,
        database,
        user,
        password: storedPwd,
      });

      logger.info("ERP config saved and reconnected");
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error({ err }, "Failed to save ERP config");
      res.status(500).json({ error: message });
    }
  });

  app.post(
    "/api/test-connection",
    requireAdmin,
    validate(TestConnectionSchema),
    async (req: Request, res: Response) => {
      const { host, port, database, user, password } = req.body;
      try {
        const { MssqlErpAdapter } = await import("../../erp/mssql.adapter.js");
        const testAdapter = new MssqlErpAdapter();
        await testAdapter.reconnect({ host, port: parseInt(port as string) || 1433, database, user, password });
        const health = await testAdapter.healthCheck();
        res.json(health);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        res.json({ ok: false, error: message });
      }
    },
  );
}
