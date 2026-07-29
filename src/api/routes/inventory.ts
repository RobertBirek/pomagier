import type { Application, Request, Response } from "express";
import crypto from "node:crypto";
import { getDb, schema } from "../../db/index.js";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { requireAdmin } from "../auth-middleware.js";
import { getAdapter } from "../adapter-provider.js";

export function registerInventoryRoutes(app: Application): void {
  app.get("/api/inventory/expected", async (req: Request, res: Response) => {
    const scope = (req.query.scope as string) || "exact";
    const area = (req.query.area as string) || "A";
    const aisle = parseInt(req.query.aisle as string) || 0;
    const rack = parseInt(req.query.rack as string) || 0;
    const shelf = parseInt(req.query.shelf as string) || 0;
    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      let q = db
        .select({
          code: schema.locations.code,
          area: schema.locations.area,
          aisle: schema.locations.aisle,
          rack: schema.locations.rack,
          shelf: schema.locations.shelf,
          productId: schema.productLocations.productId,
          quantity: schema.productLocations.quantity,
        })
        .from(schema.productLocations)
        .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id))
        .where(eq(schema.locations.area, area));
      if (["exact", "shelf", "rack"].includes(scope) && aisle)
        q = (q as any).where(eq(schema.locations.aisle, aisle));
      if (["exact", "shelf"].includes(scope) && rack)
        q = (q as any).where(eq(schema.locations.rack, rack));
      if (["exact"].includes(scope) && shelf)
        q = (q as any).where(eq(schema.locations.shelf, shelf));
      const rows = await q;
      const grouped = new Map();
      for (const r of rows) {
        if (!r.productId) continue;
        const g = grouped.get(r.productId) || {
          id: r.productId,
          symbol: "",
          name: "",
          unit: "",
          barcode: "",
          locations: [],
          qty: 0,
          subiektStock: 0,
        };
        g.locations.push(r.code);
        g.qty += r.quantity || 0;
        grouped.set(r.productId, g);
      }
      if (pool && grouped.size > 0) {
        const ids = [...grouped.keys()];
        const pr = await pool
          .request()
          .query(
            `SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name, tw_JednMiary AS unit, tw_PodstKodKresk AS barcode FROM tw__Towar WHERE tw_Id IN (${ids})`,
          );
        for (const p of pr.recordset) {
          const g = grouped.get((p as any).id);
          if (g) {
            g.symbol = (p as any).symbol;
            g.name = (p as any).name;
            g.unit = (p as any).unit;
            g.barcode = (p as any).barcode;
          }
        }
        const sr = await pool
          .request()
          .query(
            `SELECT st_TowId, SUM(st_Stan) AS total FROM tw_Stan WHERE st_TowId IN (${ids}) GROUP BY st_TowId`,
          );
        for (const s of sr.recordset) {
          const g = grouped.get((s as any).st_TowId);
          if (g) g.subiektStock = (s as any).total;
        }
      }
      res.json({ scope, area, aisle, rack, shelf, products: [...grouped.values()] });
    } catch (err) {
      logger.error({ err }, "Inventory expected failed");
      res.json({ products: [] });
    }
  });

  app.post("/api/inventory/report", requireAdmin, async (req: Request, res: Response) => {
    const { scope, area, aisle, rack, shelf, scanned } = req.body ?? {};
    if (!Array.isArray(scanned)) {
      res.status(400).json({ error: "Brak zeskanowanych" });
      return;
    }
    try {
      const expectedRes = await fetch(
        `http://localhost:3000/api/inventory/expected?scope=${scope}&area=${area}&aisle=${aisle}&rack=${rack}&shelf=${shelf}`,
      );
      const expectedData = await expectedRes.json();
      const ep: any[] = expectedData.products || [];
      const sm = new Map();
      for (const s of scanned) sm.set(s.code, (sm.get(s.code) || 0) + s.qty);
      const matched = [],
        missing = [],
        extra = [],
        qDiff = [];
      const sc = new Set(sm.keys());
      for (const p of ep) {
        const sq = sm.get(p.barcode) || sm.get(p.symbol) || 0;
        if (sq === 0) missing.push(p);
        else if (sq !== p.qty) qDiff.push({ ...p, expectedQty: p.qty, scannedQty: sq });
        else matched.push(p);
        if (p.barcode) sc.delete(p.barcode);
        sc.delete(p.symbol);
      }
      for (const c of sc) extra.push({ code: c, qty: sm.get(c) || 0 });
      try {
        const db = getDb();
        await db.insert(schema.auditLog).values({
          correlationId: crypto.randomUUID(),
          action: "inventory_report",
          details: JSON.stringify({ scope, matched: matched.length, missing: missing.length }),
        });
      } catch { /* non-critical audit log failure */ }
      res.json({
        summary: {
          expected: ep.length,
          scanned: scanned.length,
          matched: matched.length,
          missing: missing.length,
          extra: extra.length,
          quantityDiff: qDiff.length,
        },
        matched,
        missing,
        extra,
        quantityDiff: qDiff,
      });
    } catch (err) {
      logger.error({ err }, "Report failed");
      res.status(500).json({ error: "Blad" });
    }
  });
}
