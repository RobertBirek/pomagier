import type { Application, Request, Response } from "express";
import { z } from "zod";
import { getDb, schema } from "../../db/index.js";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { requireAdmin } from "../auth-middleware.js";
import { validate } from "../validation.js";

const FieldMappingsPutSchema = z.object({
  mappings: z.array(
    z.object({
      key: z.string().min(1),
      subiektField: z.string().min(1),
    }),
  ),
});

export function registerFieldMappingsRoutes(app: Application): void {
  app.get("/api/field-mappings", async (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(schema.config)
        .where(sql`${schema.config.key} LIKE 'fieldmap_%'`);
      const { DEFAULT_MAPPINGS } = await import("../../lib/field-mappings.js");

      const map = new Map(rows.map((r) => [r.key.replace("fieldmap_", ""), r.value]));
      const result = DEFAULT_MAPPINGS.map((dm) => ({
        ...dm,
        subiektField: map.get(dm.key) || dm.subiektField,
      }));
      res.json(result);
    } catch {
      const { DEFAULT_MAPPINGS } = await import("../../lib/field-mappings.js");
      res.json(DEFAULT_MAPPINGS);
    }
  });

  app.put(
    "/api/field-mappings",
    requireAdmin,
    validate(
      z.array(
        z.object({
          key: z.string().min(1),
          subiektField: z.string().min(1),
        }),
      ),
    ),
    async (req: Request, res: Response) => {
      const mappings = req.body as { key: string; subiektField: string }[];
      try {
        const db = getDb();
        for (const m of mappings) {
          await db
            .insert(schema.config)
            .values({ key: `fieldmap_${m.key}`, value: m.subiektField })
            .onConflictDoUpdate({ target: schema.config.key, set: { value: m.subiektField } });
        }
        logger.info({ count: mappings.length }, "Field mappings saved");
        res.json({ ok: true });
      } catch (err) {
        logger.error({ err }, "Failed to save field mappings");
        res.status(500).json({ error: "B\u0142\u0105d zapisu" });
      }
    },
  );
}
