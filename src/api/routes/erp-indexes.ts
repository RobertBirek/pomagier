import type { Application, Request, Response } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { getAdapter } from "../adapter-provider.js";
import { getDb, schema } from "../../db/index.js";
import { logger } from "../../lib/logger.js";
import { requireAdmin } from "../auth-middleware.js";
import { validate } from "../validation.js";

const CONFIRMATION = "UTWÓRZ INDEKSY";

const INDEXES = [
  {
    name: "IX_pomagier_tw_Towar_KodKresk",
    ddl: `CREATE NONCLUSTERED INDEX IX_pomagier_tw_Towar_KodKresk ON dbo.tw__Towar (tw_PodstKodKresk) INCLUDE (tw_Symbol, tw_Nazwa);`,
  },
  {
    name: "IX_pomagier_tw_Towar_Symbol",
    ddl: `CREATE NONCLUSTERED INDEX IX_pomagier_tw_Towar_Symbol ON dbo.tw__Towar (tw_Symbol) INCLUDE (tw_Nazwa, tw_PodstKodKresk);`,
  },
  {
    name: "IX_pomagier_uf_SynchroKodyKresk_Kod",
    ddl: `CREATE NONCLUSTERED INDEX IX_pomagier_uf_SynchroKodyKresk_Kod ON dbo.uf_SynchroKodyKresk (usk_Kod) INCLUDE (usk_IdSynchronizacja);`,
  },
] as const;

async function getPool() {
  return getAdapter().getPool?.();
}

async function getExistingIndexNames(pool: {
  request: () => { query: (sql: string) => Promise<{ recordset: unknown[] }> };
}) {
  const result = await pool.request().query(`
    SELECT name
    FROM sys.indexes
    WHERE name IN (${INDEXES.map((index) => `'${index.name}'`).join(",")})
  `);
  return new Set(result.recordset.map((row) => (row as { name: string }).name));
}

export function registerErpIndexesRoutes(app: Application): void {
  app.get("/api/erp-indexes", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const pool = await getPool();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
      const existing = await getExistingIndexNames(pool);
      res.json({
        indexes: INDEXES.map((index) => ({ name: index.name, present: existing.has(index.name) })),
        missing: INDEXES.filter((index) => !existing.has(index.name)).map((index) => index.name),
      });
    } catch (err) {
      logger.error({ err }, "ERP index status failed");
      res.status(502).json({ error: "Nie udało się sprawdzić indeksów ERP" });
    }
  });

  app.post(
    "/api/erp-indexes/apply",
    requireAdmin,
    validate(z.object({ confirmation: z.literal(CONFIRMATION) })),
    async (req: Request, res: Response) => {
      try {
        const pool = await getPool();
        if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
        const existing = await getExistingIndexNames(pool);
        const missing = INDEXES.filter((index) => !existing.has(index.name));
        for (const index of missing) await pool.request().query(index.ddl);

        await getDb()
          .insert(schema.auditLog)
          .values({
            correlationId: crypto.randomUUID(),
            userId: req.user?.id,
            action: "erp_indexes_apply",
            details: JSON.stringify({ created: missing.map((index) => index.name) }),
          });
        res.json({
          ok: true,
          created: missing.map((index) => index.name),
          alreadyPresent: [...existing],
        });
      } catch (err) {
        logger.error({ err }, "ERP index apply failed");
        res.status(502).json({ error: "Nie udało się utworzyć indeksów ERP" });
      }
    },
  );
}
