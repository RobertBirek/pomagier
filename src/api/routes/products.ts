import type { Application, Request, Response } from "express";
import { getAdapter } from "../adapter-provider.js";
import { getDb, schema } from "../../db/index.js";
import { eq, or, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import type { ProductRow, ProductDetailRow, VatRow, GroupRow } from "../types.js";

type ProductListRow = ProductRow & { locations: string[] };

export function registerProductsRoutes(app: Application): void {
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) {
        res.json({ rows: [], total: 0, page: 1, pageSize: 50 });
        return;
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(200, Math.max(5, parseInt(req.query.pageSize as string) || 50));
      const search = ((req.query.search as string) || "").trim();
      const warehouseId = parseInt(req.query.warehouseId as string) || 0;
      const offset = (page - 1) * pageSize;

      let whereClause = "WHERE 1=1";
      const params: { name: string; value: string }[] = [];

      if (search) {
        whereClause +=
          " AND (t.tw_Symbol LIKE @search OR t.tw_Nazwa LIKE @search OR t.tw_PodstKodKresk LIKE @search)";
        params.push({ name: "search", value: `%${search}%` });
      }

      const countQuery = `SELECT COUNT(*) AS total FROM tw__Towar t ${whereClause}`;
      const dataQuery = `
        SELECT
          t.tw_Id AS id, t.tw_Symbol AS symbol, t.tw_Nazwa AS name,
          t.tw_PodstKodKresk AS barcode, t.tw_JednMiary AS unit,
          t.tw_Opis AS description,
          ISNULL((SELECT SUM(st_Stan) FROM tw_Stan WHERE st_TowId = t.tw_Id), 0) AS stock,
          ISNULL((SELECT SUM(st_StanRez) FROM tw_Stan WHERE st_TowId = t.tw_Id), 0) AS reserved
        FROM tw__Towar t
        ${whereClause}
        ORDER BY t.tw_Symbol
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `;

      const countReq = pool.request();
      for (const p of params) {
        countReq.input(p.name, p.value);
      }
      const countResult = await countReq.query(countQuery);
      const total = (countResult.recordset[0] as { total: number }).total;

      const dataReq = pool.request();
      for (const p of params) {
        dataReq.input(p.name, p.value);
      }
      dataReq.input("offset", offset);
      dataReq.input("pageSize", pageSize);
      if (warehouseId) dataReq.input("wh", warehouseId);

      const dataResult = await dataReq.query(dataQuery);
      let rows: ProductListRow[] = (dataResult.recordset as ProductRow[]).map((r) => ({
        ...r,
        locations: [],
      }));

      try {
        const db = getDb();
        const productIds = rows.map((r) => r.id);
        if (productIds.length > 0) {
          const plRows = await db
            .select({ productId: schema.productLocations.productId, code: schema.locations.code })
            .from(schema.productLocations)
            .leftJoin(
              schema.locations,
              eq(schema.productLocations.locationId, schema.locations.id),
            );

          const locMap = new Map<number, string[]>();
          for (const pl of plRows) {
            if (pl.productId && pl.code) {
              const list = locMap.get(pl.productId) || [];
              list.push(pl.code);
              locMap.set(pl.productId, list);
            }
          }
          rows = rows.map((r) => ({
            ...r,
            locations: locMap.get(r.id) || [],
          }));
        }
      } catch {
        rows = rows.map((r) => ({ ...r, locations: [] }));
      }

      res.json({
        rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      logger.error({ err }, "Products query failed");
      res.json({ rows: [], total: 0, page: 1, pageSize: 50, totalPages: 0 });
    }
  });

  app.get("/api/products/random", async (_req: Request, res: Response) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) {
        res.json({ code: "5901234567890", name: "Demo" });
        return;
      }

      const result = await pool.request().query(`
        SELECT TOP 1 tw_Symbol AS code, tw_Nazwa AS name
        FROM tw__Towar
        WHERE tw_PodstKodKresk IS NOT NULL AND tw_PodstKodKresk != ''
        ORDER BY NEWID()
      `);
      const row = result.recordset[0] as { code: string; name: string } | undefined;
      res.json(row ? { code: row.code, name: row.name } : { code: "5901234567890", name: "Demo" });
    } catch {
      res.json({ code: "5901234567890", name: "Demo" });
    }
  });

  app.get("/api/products/quick-search", async (req: Request, res: Response) => {
    const q = ((req.query.q as string) || "").trim();
    if (!q || q.length < 2) {
      res.json([]);
      return;
    }

    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) {
        res.json([]);
        return;
      }

      const result = await pool.request().input("q", `%${q}%`).query(`
        SELECT TOP 8 tw_Symbol AS code, tw_Nazwa AS name, tw_PodstKodKresk AS barcode
        FROM tw__Towar
        WHERE tw_Symbol LIKE @q OR tw_Nazwa LIKE @q OR tw_PodstKodKresk LIKE @q
        ORDER BY CASE WHEN tw_Symbol LIKE @q+'%' THEN 0 ELSE 1 END, tw_Symbol
      `);
      res.json(result.recordset);
    } catch {
      res.json([]);
    }
  });

  // --- Product detail by code (cache-first) ---
  app.get("/api/products/code/:code", async (req: Request, res: Response) => {
    const code = (decodeURIComponent(req.params.code as string) || "").trim();
    if (!code) {
      res.status(400).json({ error: "Brak kodu" });
      return;
    }
    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();

      // 1. Cache lookup
      const cached = await db
        .select()
        .from(schema.productsCache)
        .where(or(eq(schema.productsCache.barcode, code), eq(schema.productsCache.symbol, code)))
        .limit(1);

      let row: ProductDetailRow | null = null;

      // 2. MSSQL fallback
      if (cached.length === 0 && pool) {
        let mssqlResult = await pool
          .request()
          .input("code", code)
          .query(
            `SELECT tw_Id,tw_Symbol,tw_Nazwa,tw_Opis,tw_PodstKodKresk,tw_JednMiary,tw_PKWiU,tw_KodTowaru,tw_StanMin,tw_JednStanMin,tw_StanMaks,tw_DniWaznosc,tw_Masa,tw_MasaNetto,tw_CenaOtwarta,tw_ObjetySysKaucyjnym,tw_Zablokowany,tw_IdGrupa,tw_IdVatSp,tw_UrzNazwa FROM tw__Towar WHERE tw_PodstKodKresk=@code OR tw_Symbol=@code`,
          );
        if (mssqlResult.recordset.length === 0) {
          const sr = await pool
            .request()
            .input("code", code)
            .query(
              `SELECT TOP 1 usk_IdSynchronizacja FROM uf_SynchroKodyKresk WHERE usk_Kod=@code`,
            );
          if (sr.recordset.length > 0) {
            const sid = (sr.recordset[0] as { usk_IdSynchronizacja: number }).usk_IdSynchronizacja;
            mssqlResult = await pool
              .request()
              .input("id", sid)
              .query(
                `SELECT tw_Id,tw_Symbol,tw_Nazwa,tw_Opis,tw_PodstKodKresk,tw_JednMiary,tw_PKWiU,tw_KodTowaru,tw_StanMin,tw_JednStanMin,tw_StanMaks,tw_DniWaznosc,tw_Masa,tw_MasaNetto,tw_CenaOtwarta,tw_ObjetySysKaucyjnym,tw_Zablokowany,tw_IdGrupa,tw_IdVatSp,tw_UrzNazwa FROM tw__Towar WHERE tw_Id=@id`,
              );
          }
        }
        if (mssqlResult.recordset.length > 0) {
          row = mssqlResult.recordset[0] as ProductDetailRow;
          try {
            await db
              .insert(schema.productsCache)
              .values({
                id: row.tw_Id,
                symbol: row.tw_Symbol,
                name: row.tw_Nazwa,
                barcode: row.tw_PodstKodKresk || null,
                unit: row.tw_JednMiary || "szt",
              })
              .onConflictDoUpdate({
                target: schema.productsCache.id,
                set: {
                  symbol: row.tw_Symbol,
                  name: row.tw_Nazwa,
                  barcode: row.tw_PodstKodKresk || null,
                  unit: row.tw_JednMiary || "szt",
                  updatedAt: sql`now()`,
                },
              });
          } catch {
            /* ok */
          }
        }
      }

      if (!row && cached.length > 0 && pool) {
        const r2 = await pool
          .request()
          .input("id", cached[0].id)
          .query(
            `SELECT tw_Id,tw_Symbol,tw_Nazwa,tw_Opis,tw_PodstKodKresk,tw_JednMiary,tw_PKWiU,tw_KodTowaru,tw_StanMin,tw_JednStanMin,tw_StanMaks,tw_DniWaznosc,tw_Masa,tw_MasaNetto,tw_CenaOtwarta,tw_ObjetySysKaucyjnym,tw_Zablokowany,tw_IdGrupa,tw_IdVatSp,tw_UrzNazwa FROM tw__Towar WHERE tw_Id=@id`,
          );
        if (r2.recordset.length > 0) row = r2.recordset[0] as ProductDetailRow;
      }

      if (!row) {
        res.status(404).json({ error: "Nie znaleziono produktu" });
        return;
      }

      const productId = row.tw_Id;

      // 3. Stocks (MSSQL)
      const stockRows = pool
        ? await pool
            .request()
            .input("id", productId)
            .query(
              `SELECT s.st_MagId,m.mag_Symbol,m.mag_Nazwa,s.st_Stan,s.st_StanRez,s.st_StanMin,s.st_StanMax FROM tw_Stan s JOIN sl_Magazyn m ON m.mag_Id=s.st_MagId WHERE s.st_TowId=@id`,
            )
        : { recordset: [] };

      // 4. Locations (Postgres)
      const plRows = await db
        .select({
          code: schema.locations.code,
          area: schema.locations.area,
          aisle: schema.locations.aisle,
          rack: schema.locations.rack,
          shelf: schema.locations.shelf,
          quantity: schema.productLocations.quantity,
        })
        .from(schema.productLocations)
        .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id))
        .where(eq(schema.productLocations.productId, productId));

      // 5. Movements (Postgres)
      const movements = await db
        .select()
        .from(schema.productMovements)
        .where(eq(schema.productMovements.productId, productId))
        .orderBy(sql`${schema.productMovements.createdAt} DESC`)
        .limit(20);

      // 6. VAT + group
      let vatRate = "",
        groupName = "";
      if (row.tw_IdVatSp && pool) {
        const vr = await pool
          .request()
          .input("id", row.tw_IdVatSp)
          .query("SELECT vat_Nazwa FROM sl_StawkaVAT WHERE vat_Id=@id");
        vatRate = (vr.recordset[0] as VatRow | undefined)?.vat_Nazwa ?? "";
      }
      if (row.tw_IdGrupa && pool) {
        const gr = await pool
          .request()
          .input("id", row.tw_IdGrupa)
          .query("SELECT grt_Nazwa FROM sl_GrupaTw WHERE grt_Id=@id");
        groupName = (gr.recordset[0] as GroupRow | undefined)?.grt_Nazwa ?? "";
      }

      res.json({
        productId,
        symbol: row.tw_Symbol,
        name: row.tw_Nazwa,
        description: row.tw_Opis,
        barcode: row.tw_PodstKodKresk,
        unit: row.tw_JednMiary,
        pkwiu: row.tw_PKWiU,
        productCode: row.tw_KodTowaru,
        minStock: row.tw_StanMin,
        maxStock: row.tw_StanMaks,
        expiryDays: row.tw_DniWaznosc,
        weight: row.tw_Masa,
        netWeight: row.tw_MasaNetto,
        ...(req.user?.role === "admin" ? { openPrice: row.tw_CenaOtwarta } : {}),
        depositSystem: row.tw_ObjetySysKaucyjnym,
        blocked: row.tw_Zablokowany,
        vatRate,
        groupName,
        producerCode: row.tw_UrzNazwa,
        stocks: stockRows.recordset,
        locations: plRows.map((l) => ({
          code: l.code,
          area: l.area,
          aisle: l.aisle,
          rack: l.rack,
          shelf: l.shelf,
          quantity: l.quantity ?? 1,
        })),
        movements: movements.map((m) => ({
          id: m.id,
          symbol: m.symbol,
          name: m.name,
          fromCode: m.fromCode,
          toCode: m.toCode,
          quantity: m.quantity,
          operator: m.operator,
          createdAt: m.createdAt,
        })),
      });
    } catch (err) {
      logger.error({ err, code }, "Product code detail failed");
      res.status(500).json({ error: "Błąd" });
    }
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
    const productId = parseInt(req.params.id as string);
    if (!productId) {
      res.status(400).json({ error: "Brak ID" });
      return;
    }
    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) {
        res.status(503).json({ error: "MSSQL niedostępny" });
        return;
      }

      const result = await pool.request().input("id", productId).query(`
        SELECT tw_Id, tw_Symbol, tw_Nazwa, tw_Opis, tw_PodstKodKresk, tw_JednMiary,
               tw_PKWiU, tw_KodTowaru, tw_StanMin, tw_JednStanMin, tw_StanMaks, tw_DniWaznosc,
               tw_Masa, tw_MasaNetto, tw_CenaOtwarta, tw_ObjetySysKaucyjnym, tw_Zablokowany,
               tw_Pole1, tw_Pole2, tw_Pole3, tw_IdGrupa, tw_IdVatSp, tw_UrzNazwa
        FROM tw__Towar WHERE tw_Id = @id
      `);
      const row = result.recordset[0] as ProductDetailRow | undefined;
      if (!row) {
        res.status(404).json({ error: "Nie znaleziono" });
        return;
      }

      const stockRows = await pool.request().input("id", productId).query(`
        SELECT s.st_MagId, m.mag_Symbol, m.mag_Nazwa, s.st_Stan, s.st_StanRez, s.st_StanMin, s.st_StanMax
        FROM tw_Stan s JOIN sl_Magazyn m ON m.mag_Id = s.st_MagId WHERE s.st_TowId = @id
      `);

      const plRows = await db
        .select({
          code: schema.locations.code,
          area: schema.locations.area,
          aisle: schema.locations.aisle,
          rack: schema.locations.rack,
          shelf: schema.locations.shelf,
        })
        .from(schema.productLocations)
        .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id))
        .where(eq(schema.productLocations.productId, productId));

      const movements = await db
        .select()
        .from(schema.productMovements)
        .where(eq(schema.productMovements.productId, productId))
        .orderBy(sql`${schema.productMovements.createdAt} DESC`)
        .limit(10);

      let vatRate = "";
      if (row.tw_IdVatSp) {
        const vatResult = await pool
          .request()
          .input("id", row.tw_IdVatSp)
          .query("SELECT vat_Nazwa FROM sl_StawkaVAT WHERE vat_Id = @id");
        const vatRow = vatResult.recordset[0] as VatRow | undefined;
        if (vatRow) vatRate = vatRow.vat_Nazwa;
      }

      let groupName = "";
      if (row.tw_IdGrupa) {
        const grResult = await pool
          .request()
          .input("id", row.tw_IdGrupa)
          .query("SELECT grt_Nazwa FROM sl_GrupaTw WHERE grt_Id = @id");
        const grRow = grResult.recordset[0] as GroupRow | undefined;
        if (grRow) groupName = grRow.grt_Nazwa;
      }

      res.json({
        id: row.tw_Id,
        symbol: row.tw_Symbol,
        name: row.tw_Nazwa,
        description: row.tw_Opis,
        barcode: row.tw_PodstKodKresk,
        unit: row.tw_JednMiary,
        pkwiu: row.tw_PKWiU,
        productCode: row.tw_KodTowaru,
        minStock: row.tw_StanMin,
        minStockUnit: row.tw_JednStanMin,
        maxStock: row.tw_StanMaks,
        expiryDays: row.tw_DniWaznosc,
        weight: row.tw_Masa,
        netWeight: row.tw_MasaNetto,
        ...(req.user?.role === "admin" ? { openPrice: row.tw_CenaOtwarta } : {}),
        depositSystem: row.tw_ObjetySysKaucyjnym,
        blocked: row.tw_Zablokowany,
        vatRate,
        groupName,
        producerCode: row.tw_UrzNazwa,
        stocks: stockRows.recordset,
        locations: plRows,
        movements,
      });
    } catch (err) {
      logger.error({ err }, "Product detail failed");
      res.status(500).json({ error: "Błąd" });
    }
  });
}
