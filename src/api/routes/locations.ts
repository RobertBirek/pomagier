import type express from "express";
import crypto from "node:crypto";
import { getDb, schema } from "../../db/index.js";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { requireAdmin } from "../auth-middleware.js";
import { checkIdempotency } from "../idempotency.js";
import { getAdapter } from "../adapter-provider.js";

interface SubiektLocationRow {
  location: string;
}
interface SubiektProductLocRow {
  productId: number;
  locRaw: string;
}
interface SubiektProductRow {
  id: number;
  symbol: string;
  name: string;
}
interface SubiektFieldRow {
  val: string;
}
interface SubiektStockRow {
  total: number;
}
interface SubiektIdRow {
  id: number;
}
interface SubiektProductDetailRow {
  tw_Symbol: string;
  tw_Nazwa: string;
}

interface DuplicateEntry {
  productId: number;
  symbol: string;
  name: string;
  locations: { code: string; area: string; aisle: number; rack: number; quantity: number }[];
  suggestion: string;
}

interface GridCell {
  code: string;
  productCount: number;
  totalQuantity: number;
}
interface GridResult {
  [areaName: string]: {
    maxAisle: number;
    maxShelf: number;
    grid: Record<string, Record<string, GridCell>>;
  };
}

/** Whitelist of allowed Subiekt GT field names for location mapping. Prevents SQL Injection. */
const ALLOWED_LOCATION_FIELDS = new Set([
  "tw_Pole1",
  "tw_Pole2",
  "tw_Pole3",
  "tw_Pole4",
  "tw_Pole5",
  "tw_Pole6",
  "tw_Pole7",
  "tw_Pole8",
  "tw_Opis",
  "tw_Uwagi",
]);

async function getLocationField(): Promise<string> {
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.config)
      .where(eq(schema.config.key, "fieldmap_location"));
    const field = row?.value || "tw_Pole1";
    if (!ALLOWED_LOCATION_FIELDS.has(field)) {
      logger.warn({ field }, "Blocked untrusted locationField — falling back to tw_Pole1");
      return "tw_Pole1";
    }
    return field;
  } catch {
    return "tw_Pole1";
  }
}

export { getLocationField };

/** Fetch operator's full name from Subiekt GT. Falls back to "Operator ID N" if MSSQL unavailable. */
async function getOperatorName(subiektUzId: number): Promise<string> {
  try {
    const adapter = getAdapter();
    const pool = await adapter.getPool?.();
    if (!pool) return `Operator ID ${subiektUzId}`;
    const result = await pool
      .request()
      .input("id", subiektUzId)
      .query(
        "SELECT uz_Imie AS firstName, uz_Nazwisko AS lastName FROM pd_Uzytkownik WHERE uz_Id = @id",
      );
    const row = result.recordset[0] as { firstName: string; lastName: string } | undefined;
    if (row && (row.firstName || row.lastName)) {
      return `${row.firstName || ""} ${row.lastName || ""}`.trim();
    }
    return `Operator ID ${subiektUzId}`;
  } catch {
    return `Operator ID ${subiektUzId}`;
  }
}

export function registerLocationsRoutes(app: express.Express) {
  // --- Lokalizacje (tylko Postgres) ---
  app.get("/api/locations", async (_req, res) => {
    try {
      const db = getDb();
      const { sortLocations } = await import("../../lib/locations.js");
      const rows = await db.select().from(schema.locations).orderBy(schema.locations.code);

      const parsed = rows.map((r) => ({
        raw: r.code,
        area: r.area,
        aisle: r.aisle,
        rack: r.rack,
        shelf: r.shelf,
        spot: r.spot,
        label: r.label,
      }));

      res.json(sortLocations(parsed));
    } catch {
      res.json([]);
    }
  });

  // --- Import lokalizacji z Subiekta (jednorazowo) ---
  app.post("/api/locations/import", requireAdmin, async (_req, res) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });

      const locationField = await getLocationField();
      const result = await pool.request().query(`
        SELECT NULLIF(${locationField}, '') AS location
        FROM tw__Towar
        WHERE ${locationField} IS NOT NULL AND ${locationField} != ''
        GROUP BY ${locationField}
      `);

      const { parseLocation } = await import("../../lib/locations.js");
      const db = getDb();

      // Normalize existing entries (fix missing spaces)
      const existing = await db.select().from(schema.locations);
      for (const loc of existing) {
        const parsed = parseLocation(loc.code);
        if (parsed && parsed.raw !== loc.code) {
          // Delete old malformed, insert corrected
          await db.delete(schema.locations).where(eq(schema.locations.id, loc.id));
          try {
            await db
              .insert(schema.locations)
              .values({
                code: parsed.raw,
                area: parsed.area,
                aisle: parsed.aisle,
                rack: parsed.rack,
                shelf: parsed.shelf,
                spot: parsed.spot,
                label: parsed.label,
              })
              .onConflictDoNothing();
          } catch {
            /* skip if already exists */
          }
        }
      }

      let imported = 0;
      let skipped = 0;

      for (const row of result.recordset) {
        const raw = (row as SubiektLocationRow).location;
        // Obsługa wielu lokalizacji oddzielonych średnikiem
        const parts = raw
          .split(/[,;]/)
          .map((s: string) => s.trim())
          .filter(Boolean);
        for (const part of parts) {
          const parsed = parseLocation(part);
          if (!parsed) {
            skipped++;
            continue;
          }
          try {
            await db
              .insert(schema.locations)
              .values({
                code: parsed.raw,
                area: parsed.area,
                aisle: parsed.aisle,
                rack: parsed.rack,
                shelf: parsed.shelf,
                spot: parsed.spot,
                label: parsed.label,
              })
              .onConflictDoNothing();
            imported++;
          } catch {
            skipped++;
          }
        }
      }

      logger.info({ imported, skipped }, "Location import completed");
      res.json({ ok: true, imported, skipped });
    } catch (err) {
      logger.error({ err }, "Import failed");
      res.status(500).json({ error: "Import nie powiódł się" });
    }
  });

  // --- Dodaj nową lokalizację ---
  app.post("/api/locations", requireAdmin, async (req, res) => {
    const { code } = req.body ?? {};
    if (!code) {
      res.status(400).json({ error: "Brak kodu lokalizacji" });
      return;
    }

    const { parseLocation } = await import("../../lib/locations.js");
    const parsed = parseLocation(code);
    if (!parsed) {
      res.status(422).json({ error: "Nieprawidłowy format lokalizacji. Oczekiwano: A 1-2-3-4" });
      return;
    }

    try {
      const db = getDb();

      // Sprawdź duplikat
      const [existing] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.code, parsed.raw));
      if (existing) {
        res.status(409).json({ error: "Lokalizacja już istnieje", location: existing });
        return;
      }

      const [created] = await db
        .insert(schema.locations)
        .values({
          code: parsed.raw,
          area: parsed.area,
          aisle: parsed.aisle,
          rack: parsed.rack,
          shelf: parsed.shelf,
          spot: parsed.spot,
          label: parsed.label,
        })
        .returning();

      logger.info({ code: parsed.raw }, "New location added");
      res.status(201).json({ ok: true, location: created });
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr?.code === "23505") {
        res.status(409).json({ error: "Lokalizacja już istnieje" });
        return;
      }
      logger.error({ err }, "Failed to add location");
      res.status(500).json({ error: "Błąd zapisu" });
    }
  });

  // --- Produkty w lokalizacji (stary endpoint, przez MSSQL) ---
  app.get("/api/products-by-location", async (req, res) => {
    const location = req.query.location as string;
    if (!location) {
      res.status(400).json({ error: "Brak parametru location" });
      return;
    }
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.json([]);

      const result = await pool.request().input("location", location).query(`
          SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name, tw_Pole1 AS location,
                 tw_JednMiary AS unit, tw_PodstKodKresk AS barcode
          FROM tw__Towar
          WHERE tw_Pole1 = @location
          ORDER BY tw_Symbol
        `);

      res.json(result.recordset);
    } catch (err) {
      logger.error({ err }, "Products by location failed");
      res.json([]);
    }
  });

  // --- Aktualizuj lokalizację produktu w Subiekt GT ---
  app.put("/api/products/:id/location", requireAdmin, async (req, res) => {
    const productId = parseInt(req.params.id as string);
    const { location } = req.body ?? {};

    if (!productId || !location) {
      res.status(400).json({ error: "Brak productId lub location" });
      return;
    }

    const { parseLocation } = await import("../../lib/locations.js");
    const parsed = parseLocation(location);
    if (!parsed) {
      res.status(422).json({ error: "Nieprawidłowy format lokalizacji" });
      return;
    }

    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });

      const locationField = await getLocationField();

      // Pobierz aktualną wartość pola
      const current = await pool
        .request()
        .input("id", productId)
        .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);

      const existing = (current.recordset[0] as SubiektFieldRow | undefined)?.val || "";
      const locations = existing
        .split(/[,;]/)
        .map((s: string) => s.trim())
        .filter(Boolean);

      // Sprawdź czy lokalizacja już istnieje
      if (locations.includes(parsed.raw)) {
        res.json({ ok: true, location: parsed.raw, message: "Lokalizacja już przypisana" });
        return;
      }

      // Dodaj nową lokalizację (oddziel średnikiem)
      locations.push(parsed.raw);
      const newValue = locations.join(",");

      await pool
        .request()
        .input("id", productId)
        .input("val", newValue)
        .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);

      logger.info(
        { productId, location: parsed.raw, field: locationField, value: newValue },
        "Product location updated in Subiekt",
      );
      res.json({ ok: true, location: parsed.raw, field: locationField, value: newValue });
    } catch (err) {
      logger.error({ err, productId, location }, "Failed to update product location");
      res.status(500).json({ error: "Błąd zapisu do Subiekt GT" });
    }
  });

  // --- Synchronizuj product_locations z Subiekt GT ---
  app.post("/api/locations/sync", requireAdmin, async (_req, res) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });

      const locationField = await getLocationField();
      const { parseLocation } = await import("../../lib/locations.js");
      const db = getDb();

      // Pobierz wszystkie towary z lokalizacjami
      const result = await pool.request().query(`
        SELECT tw_Id AS productId, NULLIF(${locationField}, '') AS locRaw
        FROM tw__Towar
        WHERE ${locationField} IS NOT NULL AND ${locationField} != ''
      `);

      // Pobierz wszystkie lokalizacje z Postgres
      const allLocations = await db.select().from(schema.locations);

      let inserted = 0;
      let skipped = 0;

      // Wyczyść starą tabelę
      await db.delete(schema.productLocations);

      for (const row of result.recordset) {
        const productId = (row as SubiektProductLocRow).productId;
        const locRaw = (row as SubiektProductLocRow).locRaw;
        const parts = locRaw
          .split(/[,;]/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        for (const part of parts) {
          const parsed = parseLocation(part);
          if (!parsed) {
            skipped++;
            continue;
          }

          const loc = allLocations.find((l) => l.code === parsed.raw);
          if (!loc) {
            skipped++;
            continue;
          }

          try {
            await db
              .insert(schema.productLocations)
              .values({
                productId,
                locationId: loc.id,
                quantity: 1,
              })
              .onConflictDoNothing();
            inserted++;
          } catch {
            skipped++;
          }
        }
      }

      logger.info({ inserted, skipped }, "Product-location sync completed");
      res.json({ ok: true, inserted, skipped });
    } catch (err) {
      logger.error({ err }, "Sync failed");
      res.status(500).json({ error: "Synchronizacja nie powiodła się" });
    }
  });

  // --- Przypisz towary do lokalizacji ---
  app.post("/api/locations/assign", requireAdmin, async (req, res) => {
    const { codes, location } = req.body ?? {};
    if (!Array.isArray(codes) || codes.length === 0 || !location) {
      res.status(400).json({ error: "Brak kodów lub lokalizacji" });
      return;
    }

    const idemKey = req.headers["x-idempotency-key"] as string;
    if (idemKey) {
      const cached = checkIdempotency(idemKey);
      if (cached) {
        res.json(cached.result);
        return;
      }
    }

    const { parseLocation } = await import("../../lib/locations.js");
    const parsed = parseLocation(location);
    if (!parsed) {
      res.status(422).json({ error: "Nieprawidłowy format lokalizacji" });
      return;
    }

    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });

      // Upewnij się że lokalizacja istnieje w Postgres
      let [loc] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.code, parsed.raw));
      if (!loc) {
        [loc] = await db
          .insert(schema.locations)
          .values({
            code: parsed.raw,
            area: parsed.area,
            aisle: parsed.aisle,
            rack: parsed.rack,
            shelf: parsed.shelf,
            spot: parsed.spot,
            label: parsed.label,
          })
          .returning();
      }

      // Znajdź produkty w Subiekcie po symbolu lub EAN
      const foundProducts: { id: number; symbol: string; name: string }[] = [];
      const notFound: string[] = [];

      for (const code of codes) {
        const result = await pool.request().input("code", code).query(`
          SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name
          FROM tw__Towar
          WHERE tw_PodstKodKresk = @code
        `);
        if (result.recordset.length > 0) {
          foundProducts.push(result.recordset[0] as SubiektProductRow);
        } else {
          notFound.push(code);
        }
      }

      if (foundProducts.length === 0) {
        res.status(404).json({ error: "Nie znaleziono żadnego towaru", notFound });
        return;
      }

      // Sumuj duplikaty
      const grouped = new Map<number, number>();
      for (const p of foundProducts) {
        grouped.set(p.id, (grouped.get(p.id) || 0) + 1);
      }

      // Zapisz do product_locations
      const locationField = await getLocationField();
      for (const [productId, qty] of grouped) {
        await db
          .insert(schema.productLocations)
          .values({ productId, locationId: loc.id, quantity: qty })
          .onConflictDoUpdate({
            target: [schema.productLocations.productId, schema.productLocations.locationId],
            set: { quantity: sql`${schema.productLocations.quantity} + ${qty}` },
          });

        // Aktualizuj tw_Pole1 w Subiekcie
        const current = await pool
          .request()
          .input("id", productId)
          .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
        const existing = ((current.recordset[0] as SubiektFieldRow | undefined)?.val || "")
          .split(/[,;]/)
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (!existing.includes(parsed.raw)) {
          existing.push(parsed.raw);
          await pool
            .request()
            .input("id", productId)
            .input("val", existing.join(","))
            .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);
        }
      }

      logger.info(
        { productCount: grouped.size, totalQty: foundProducts.length, location: parsed.raw },
        "Products assigned to location",
      );

      // Log movements
      const operatorName = await getOperatorName(req.user?.subiektUzId ?? 0);
      for (const [productId, qty] of grouped) {
        const p = foundProducts.find((fp) => fp.id === productId)!;
        await db.insert(schema.productMovements).values({
          productId,
          symbol: p.symbol,
          name: p.name,
          toLocationId: loc.id,
          toCode: parsed.raw,
          quantity: qty,
          operator: operatorName,
          correlationId: crypto.randomUUID(),
        });
      }
      res.json({
        ok: true,
        assigned: grouped.size,
        totalQuantity: foundProducts.length,
        location: parsed.raw,
        products: [...grouped].map(([id, qty]) => {
          const p = foundProducts.find((fp) => fp.id === id)!;
          return { symbol: p.symbol, name: p.name, quantity: qty };
        }),
        notFound,
      });
    } catch (err) {
      logger.error({ err }, "Assign failed");
      res.status(500).json({ error: "Błąd zapisu" });
    }
  });

  // --- Lokalizacje z liczbą produktów i ilościami ---
  app.get("/api/locations/stats", async (_req, res) => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          code: schema.locations.code,
          area: schema.locations.area,
          aisle: schema.locations.aisle,
          rack: schema.locations.rack,
          shelf: schema.locations.shelf,
          label: schema.locations.label,
          productCount: sql<number>`COUNT(${schema.productLocations.productId})::int`,
          totalQuantity: sql<number>`COALESCE(SUM(${schema.productLocations.quantity}), 0)::int`,
        })
        .from(schema.locations)
        .leftJoin(
          schema.productLocations,
          eq(schema.locations.id, schema.productLocations.locationId),
        )
        .groupBy(schema.locations.id)
        .orderBy(schema.locations.code);

      res.json(rows);
    } catch {
      res.json([]);
    }
  });

  // --- Cofnij ostatnią operację przypisania ---
  app.post("/api/locations/undo", requireAdmin, async (req, res) => {
    const { location, codes } = req.body ?? {};
    if (!location || !Array.isArray(codes) || codes.length === 0) {
      res.status(400).json({ error: "Brak lokalizacji lub kodów" });
      return;
    }

    const { parseLocation } = await import("../../lib/locations.js");
    const parsed = parseLocation(location);
    if (!parsed) {
      res.status(422).json({ error: "Nieprawidłowa lokalizacja" });
      return;
    }

    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();

      // Find location in Postgres
      const [loc] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.code, parsed.raw));
      if (!loc) {
        res.status(404).json({ error: "Lokalizacja nie istnieje" });
        return;
      }

      let undone = 0;
      for (const code of codes) {
        if (!pool) break;
        const result = await pool
          .request()
          .input("code", code)
          .query("SELECT tw_Id AS id FROM tw__Towar WHERE tw_PodstKodKresk = @code");
        for (const row of result.recordset) {
          const productId = (row as SubiektIdRow).id;
          // Decrease quantity in product_locations (or remove if quantity gets to 0)
          await db
            .delete(schema.productLocations)
            .where(
              and(
                eq(schema.productLocations.productId, productId),
                eq(schema.productLocations.locationId, loc.id),
              ),
            );

          // Remove location from tw_Pole1 in Subiekt
          const locationField = await getLocationField();
          const current = await pool
            .request()
            .input("id", productId)
            .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
          const existing = ((current.recordset[0] as SubiektFieldRow | undefined)?.val || "")
            .split(/[,;]/)
            .map((s: string) => s.trim())
            .filter(Boolean);
          const updated = existing.filter((s: string) => s !== parsed.raw);
          if (updated.length !== existing.length) {
            await pool
              .request()
              .input("id", productId)
              .input("val", updated.join(",") || null)
              .query(`UPDATE tw__Towar SET ${locationField} = NULLIF(@val, '') WHERE tw_Id = @id`);
          }
          undone++;
        }
      }

      logger.info({ location: parsed.raw, undone }, "Assignment undone");

      // Log undo movements
      const operatorName = await getOperatorName(req.user?.subiektUzId ?? 0);
      for (const code of [...new Set(codes)]) {
        if (!pool) break;
        const r = await pool
          .request()
          .input("code", code)
          .query(
            "SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name FROM tw__Towar WHERE tw_PodstKodKresk = @code",
          );
        for (const row of r.recordset) {
          await db.insert(schema.productMovements).values({
            productId: (row as SubiektProductRow).id,
            symbol: (row as SubiektProductRow).symbol,
            name: (row as SubiektProductRow).name,
            fromLocationId: loc.id,
            fromCode: parsed.raw,
            quantity: 1,
            operator: operatorName,
            correlationId: crypto.randomUUID(),
          });
        }
      }
      res.json({ ok: true, undone });
    } catch (err) {
      logger.error({ err }, "Undo failed");
      res.status(500).json({ error: "Nie udało się cofnąć" });
    }
  });

  // --- Weryfikacja stanu: Postgres vs Subiekt ---
  app.get("/api/locations/verify", async (req, res) => {
    const location = req.query.location as string;
    if (!location) {
      res.status(400).json({ error: "Brak parametru location" });
      return;
    }

    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();

      // Assigned quantity from Postgres
      const [loc] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.code, location));
      if (!loc) {
        res.json({ comparison: null });
        return;
      }

      const plRows = await db
        .select({ qty: schema.productLocations.quantity })
        .from(schema.productLocations)
        .where(eq(schema.productLocations.locationId, loc.id));
      const assigned = plRows.reduce((s, r) => s + (r.qty || 0), 0);

      // Stock in Subiekt
      let inSubiekt = 0;
      if (pool) {
        const stockResult = await pool.request().input("location", location)
          .query(`SELECT ISNULL(SUM(s.st_Stan), 0) AS total FROM tw_Stan s
                  INNER JOIN tw__Towar t ON t.tw_Id = s.st_TowId
                  WHERE t.tw_Pole1 LIKE '%' + @location + '%'`);
        inSubiekt = (stockResult.recordset[0] as SubiektStockRow | undefined)?.total || 0;
      }

      res.json({ comparison: { location, assigned, inSubiekt } });
    } catch {
      res.json({ comparison: null });
    }
  });

  // --- Duplikaty: towary w odległych lokalizacjach ---
  app.get("/api/locations/duplicates", async (_req, res) => {
    try {
      const db = getDb();
      const { parseLocation } = await import("../../lib/locations.js");

      const rows = await db
        .select({
          productId: schema.productLocations.productId,
          quantity: schema.productLocations.quantity,
          code: schema.locations.code,
          area: schema.locations.area,
          aisle: schema.locations.aisle,
          rack: schema.locations.rack,
        })
        .from(schema.productLocations)
        .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id));

      // Group by productId
      const grouped = new Map<
        number,
        {
          productId: number;
          locations: {
            code: string;
            area: string;
            aisle: number;
            rack: number;
            quantity: number;
          }[];
        }
      >();
      for (const r of rows) {
        const g = grouped.get(r.productId) || { productId: r.productId, locations: [] };
        g.locations.push({
          code: r.code,
          area: r.area,
          aisle: r.aisle,
          rack: r.rack,
          quantity: r.quantity || 0,
        });
        grouped.set(r.productId, g);
      }

      // Find products in >1 location that are distant
      const duplicates: DuplicateEntry[] = [];
      for (const [, g] of grouped) {
        if (g.locations.length < 2) continue;
        const hasDistant = g.locations.some((a) =>
          g.locations.some(
            (b) => a.code !== b.code && (a.area !== b.area || Math.abs(a.aisle - b.aisle) > 1),
          ),
        );
        if (!hasDistant) continue;

        // Get product info from Subiekt if available
        let symbol = "",
          name = "";
        try {
          const pool = await getAdapter().getPool?.();
          if (pool) {
            const pr = await pool
              .request()
              .input("id", g.productId)
              .query("SELECT tw_Symbol, tw_Nazwa FROM tw__Towar WHERE tw_Id = @id");
            if (pr.recordset[0]) {
              symbol = (pr.recordset[0] as SubiektProductDetailRow | undefined)?.tw_Symbol ?? "";
              name = (pr.recordset[0] as SubiektProductDetailRow | undefined)?.tw_Nazwa ?? "";
            }
          }
        } catch {
          logger.warn({ location: g.productId }, "duplicate check: product info skipped");
        }

        const best = g.locations.reduce((a, b) => (a.quantity > b.quantity ? a : b));
        duplicates.push({
          productId: g.productId,
          symbol,
          name,
          locations: g.locations,
          suggestion: best.code,
        });
      }

      res.json(duplicates);
    } catch {
      res.json([]);
    }
  });

  // --- Sprawdź czy produkt istnieje już w jakiejś lokalizacji ---
  app.get("/api/locations/check-product", async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.json({ found: false });
      return;
    }

    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();

      // Find product in Subiekt
      if (!pool) {
        res.json({ found: false });
        return;
      }
      const pr = await pool
        .request()
        .input("code", code)
        .query("SELECT tw_Id AS id FROM tw__Towar WHERE tw_PodstKodKresk = @code");
      if (!pr.recordset[0]) {
        res.json({ found: false });
        return;
      }
      const productId = (pr.recordset[0]! as SubiektIdRow).id;

      // Check in product_locations
      const rows = await db
        .select({ code: schema.locations.code })
        .from(schema.productLocations)
        .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id))
        .where(eq(schema.productLocations.productId, productId));

      res.json({ found: rows.length > 0, locations: rows.map((r) => r.code) });
    } catch {
      res.json({ found: false });
    }
  });

  // --- Przenieś towary między lokalizacjami ---
  app.post("/api/locations/transfer", requireAdmin, async (req, res) => {
    const { codes, fromLocation, toLocation } = req.body ?? {};
    if (!Array.isArray(codes) || codes.length === 0 || !fromLocation || !toLocation) {
      res.status(400).json({ error: "Brak kodów, źródła lub celu" });
      return;
    }

    const { parseLocation } = await import("../../lib/locations.js");
    const fromParsed = parseLocation(fromLocation);
    const toParsed = parseLocation(toLocation);
    if (!fromParsed || !toParsed) {
      res.status(422).json({ error: "Nieprawidłowy format lokalizacji" });
      return;
    }

    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
      const locationField = await getLocationField();

      // Ensure both locations exist
      let [fromLoc] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.code, fromParsed.raw));
      if (!fromLoc) {
        [fromLoc] = await db
          .insert(schema.locations)
          .values({
            code: fromParsed.raw,
            area: fromParsed.area,
            aisle: fromParsed.aisle,
            rack: fromParsed.rack,
            shelf: fromParsed.shelf,
            spot: fromParsed.spot,
            label: fromParsed.label,
          })
          .returning();
      }
      let [toLoc] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.code, toParsed.raw));
      if (!toLoc) {
        [toLoc] = await db
          .insert(schema.locations)
          .values({
            code: toParsed.raw,
            area: toParsed.area,
            aisle: toParsed.aisle,
            rack: toParsed.rack,
            shelf: toParsed.shelf,
            spot: toParsed.spot,
            label: toParsed.label,
          })
          .returning();
      }

      // Find products
      const foundProducts: { id: number; symbol: string; name: string }[] = [];
      for (const code of codes) {
        const r = await pool
          .request()
          .input("code", code)
          .query(
            "SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name FROM tw__Towar WHERE tw_PodstKodKresk = @code",
          );
        for (const row of r.recordset) foundProducts.push(row as SubiektProductRow);
      }

      // Group quantities
      const grouped = new Map<number, number>();
      for (const p of foundProducts) grouped.set(p.id, (grouped.get(p.id) || 0) + 1);

      let moved = 0;
      const operatorName = await getOperatorName(req.user?.subiektUzId ?? 0);
      for (const [productId, qty] of grouped) {
        const p = foundProducts.find((fp) => fp.id === productId)!;

        // Remove from source location
        await db
          .delete(schema.productLocations)
          .where(
            and(
              eq(schema.productLocations.productId, productId),
              eq(schema.productLocations.locationId, fromLoc.id),
            ),
          );

        // Add to target location
        await db
          .insert(schema.productLocations)
          .values({ productId, locationId: toLoc.id, quantity: qty })
          .onConflictDoUpdate({
            target: [schema.productLocations.productId, schema.productLocations.locationId],
            set: { quantity: sql`${schema.productLocations.quantity} + ${qty}` },
          });

        // Update Subiekt: remove from source, add to target
        const currentSourceRes = await pool
          .request()
          .input("id", productId)
          .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
        const currentSourceVal =
          (currentSourceRes.recordset[0] as SubiektFieldRow | undefined)?.val || "";
        const locations = currentSourceVal
          .split(/[,;]/)
          .map((s: string) => s.trim())
          .filter(Boolean);
        const updated = locations.filter((s: string) => s !== fromParsed.raw);
        if (!updated.includes(toParsed.raw)) updated.push(toParsed.raw);
        await pool
          .request()
          .input("id", productId)
          .input("val", updated.join(","))
          .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);

        // Log movement
        await db.insert(schema.productMovements).values({
          productId,
          symbol: p.symbol,
          name: p.name,
          fromLocationId: fromLoc.id,
          toLocationId: toLoc.id,
          fromCode: fromParsed.raw,
          toCode: toParsed.raw,
          quantity: qty,
          operator: operatorName,
          correlationId: crypto.randomUUID(),
        });

        moved += qty;
      }

      logger.info({ from: fromParsed.raw, to: toParsed.raw, moved }, "Transfer completed");
      res.json({ ok: true, moved, from: fromParsed.raw, to: toParsed.raw });
    } catch (err) {
      logger.error({ err }, "Transfer failed");
      res.status(500).json({ error: "Transfer nie powiódł się" });
    }
  });

  // --- Weryfikacja spójności Postgres ↔ Subiekt tw_PoleX ---
  app.get("/api/locations/verify-sync", async (_req, res) => {
    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
      const locationField = await getLocationField();

      // Get all products with their Postgres locations
      const plRows = await db
        .select({ productId: schema.productLocations.productId, code: schema.locations.code })
        .from(schema.productLocations)
        .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id));

      // Group by productId
      const postgresMap = new Map<number, Set<string>>();
      for (const r of plRows) {
        const s = postgresMap.get(r.productId) || new Set();
        s.add(r.code);
        postgresMap.set(r.productId, s);
      }

      // Get Subiekt data
      const subiektRows = await pool
        .request()
        .query(
          `SELECT tw_Id AS id, NULLIF(${locationField}, '') AS val FROM tw__Towar WHERE ${locationField} IS NOT NULL AND ${locationField} != ''`,
        );

      const subiektMap = new Map<number, Set<string>>();
      for (const r of subiektRows.recordset) {
        const codes = ((r as SubiektFieldRow).val || "")
          .split(/[,;]/)
          .map((s: string) => s.trim())
          .filter(Boolean);
        subiektMap.set((r as SubiektIdRow).id, new Set(codes));
      }

      // Compare
      const allIds = new Set([...postgresMap.keys(), ...subiektMap.keys()]);
      const mismatches: { productId: number; postgres: string[]; subiekt: string[] }[] = [];

      for (const id of allIds) {
        const pg = [...(postgresMap.get(id) || new Set())].sort();
        const sub = [...(subiektMap.get(id) || new Set())].sort();
        if (pg.join(",") !== sub.join(",")) {
          mismatches.push({ productId: id, postgres: pg, subiekt: sub });
        }
      }

      res.json({
        totalProducts: allIds.size,
        synced: allIds.size - mismatches.length,
        mismatches: mismatches.length,
        details: mismatches.slice(0, 20),
      });
    } catch (err) {
      logger.error({ err }, "Verify sync failed");
      res.status(500).json({ error: "Weryfikacja nie powiodła się" });
    }
  });

  // --- Siatka magazynu (grid data) ---
  app.get("/api/locations/grid", async (_req, res) => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          area: schema.locations.area,
          aisle: schema.locations.aisle,
          shelf: schema.locations.shelf,
          sampleCode: sql<string>`MIN(${schema.locations.code})`,
          productCount: sql<number>`COUNT(${schema.productLocations.productId})::int`,
          totalQuantity: sql<number>`COALESCE(SUM(${schema.productLocations.quantity}), 0)::int`,
        })
        .from(schema.locations)
        .leftJoin(
          schema.productLocations,
          eq(schema.locations.id, schema.productLocations.locationId),
        )
        .groupBy(schema.locations.area, schema.locations.aisle, schema.locations.shelf)
        .orderBy(schema.locations.area, schema.locations.aisle, schema.locations.shelf);

      // Build grid structure
      const areas = new Map<
        string,
        {
          aisles: Map<
            number,
            Map<number, { code: string; productCount: number; totalQuantity: number }>
          >;
          maxAisle: number;
          maxShelf: number;
        }
      >();

      for (const r of rows) {
        if (!areas.has(r.area)) areas.set(r.area, { aisles: new Map(), maxAisle: 0, maxShelf: 0 });
        const area = areas.get(r.area)!;
        if (!area.aisles.has(r.aisle)) area.aisles.set(r.aisle, new Map());
        area.aisles.get(r.aisle)!.set(r.shelf, {
          code: r.sampleCode,
          productCount: r.productCount,
          totalQuantity: r.totalQuantity,
        });
        if (r.aisle > area.maxAisle) area.maxAisle = r.aisle;
        if (r.shelf > area.maxShelf) area.maxShelf = r.shelf;
      }

      const result: GridResult = {};
      for (const [areaName, area] of areas) {
        result[areaName] = { maxAisle: area.maxAisle, maxShelf: area.maxShelf, grid: {} };
        for (const [aisle, shelves] of area.aisles) {
          result[areaName].grid[aisle] = {};
          for (const [shelf, cell] of shelves) {
            result[areaName].grid[aisle][shelf] = {
              code: cell.code,
              productCount: cell.productCount,
              totalQuantity: cell.totalQuantity,
            };
          }
        }
      }

      res.json(result);
    } catch {
      res.json({});
    }
  });

  // --- Puste lokalizacje ---
  app.get("/api/locations/empty", async (_req, res) => {
    try {
      const db = getDb();
      const rows = await db
        .select({
          code: schema.locations.code,
          area: schema.locations.area,
          aisle: schema.locations.aisle,
          rack: schema.locations.rack,
          shelf: schema.locations.shelf,
          label: schema.locations.label,
        })
        .from(schema.locations)
        .leftJoin(
          schema.productLocations,
          eq(schema.locations.id, schema.productLocations.locationId),
        )
        .where(sql`${schema.productLocations.productId} IS NULL`)
        .orderBy(schema.locations.area, schema.locations.aisle, schema.locations.rack);

      res.json(rows);
    } catch {
      res.json([]);
    }
  });

  // --- Eksport etykiet PDF z kodami Code 128 ---
  app.get("/api/locations/export-pdf", async (req, res) => {
    const codes = ((req.query.codes as string) || "").split(",").filter(Boolean);
    if (codes.length === 0) {
      res.status(400).json({ error: "Brak kodów" });
      return;
    }

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const cols = 3;
      const rows = 8;
      const cellW = 60;
      const cellH = 30;
      const marginX = 12;
      const marginY = 15;
      const fontSize = 8;

      codes.slice(0, cols * rows).forEach((code, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = marginX + col * cellW;
        const y = marginY + row * cellH;

        // Border
        doc.setDrawColor(200);
        doc.setLineWidth(0.2);
        doc.rect(x, y, cellW - 2, cellH - 2);

        // Barcode placeholder (Code 128 text)
        doc.setFontSize(fontSize + 2);
        doc.text(code, x + (cellW - 2) / 2, y + 8, { align: "center" });

        // Label
        doc.setFontSize(fontSize - 2);
        doc.setTextColor(100);
        const loc = code.match(/^([A-Z])\s*(\d+)-(\d+)-(\d+)-(\d+)$/);
        const label = loc
          ? `A:${loc[1]} | Rząd:${loc[2]} | Regał:${loc[3]} | Półka:${loc[4]}`
          : code;
        doc.text(label, x + (cellW - 2) / 2, y + 14, { align: "center" });
        doc.text("PomagierGT", x + (cellW - 2) / 2, y + 20, { align: "center" });
        doc.setTextColor(0);
      });

      const pdf = Buffer.from(doc.output("arraybuffer"));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=labels.pdf");
      res.send(pdf);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "PDF generation failed";
      res.status(500).json({ error: message });
    }
  });

  // --- Napraw rozbieżności: zsynchronizuj Subiekt z Postgres ---
  app.post("/api/locations/fix-sync", requireAdmin, async (_req, res) => {
    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
      const locationField = await getLocationField();

      const plRows = await db
        .select({ productId: schema.productLocations.productId, code: schema.locations.code })
        .from(schema.productLocations)
        .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id));
      const postgresMap = new Map<number, string[]>();
      for (const r of plRows) {
        const list = postgresMap.get(r.productId) || [];
        list.push(r.code);
        postgresMap.set(r.productId, list);
      }

      let fixed = 0;
      for (const [productId, codes] of postgresMap) {
        const current = await pool
          .request()
          .input("id", productId)
          .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
        const existing = ((current.recordset[0] as SubiektFieldRow | undefined)?.val || "")
          .split(/[,;]/)
          .map((s: string) => s.trim())
          .filter(Boolean);
        if ([...codes].sort().join(",") !== [...existing].sort().join(",")) {
          await pool
            .request()
            .input("id", productId)
            .input("val", codes.join(","))
            .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);
          fixed++;
        }
      }
      res.json({ ok: true, fixed });
    } catch (err) {
      logger.error({ err }, "Fix sync failed");
      res.status(500).json({ error: "Naprawa nie powiodła się" });
    }
  });

  // --- Wyczyść pole lokalizacji w Subiekcie ---
  app.post("/api/locations/clear-field", requireAdmin, async (_req, res) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
      const locationField = await getLocationField();
      const result = await pool
        .request()
        .query(`UPDATE tw__Towar SET ${locationField} = '' WHERE ${locationField} IS NOT NULL`);
      // Also clear Postgres product_locations to keep both sides in sync
      const db = getDb();
      await db.delete(schema.productLocations);
      res.json({ ok: true, rowsAffected: result.rowsAffected?.[0] || 0 });
    } catch (err) {
      logger.error({ err }, "Clear field failed");
      res.status(500).json({ error: "Nie udało się" });
    }
  });

  // --- Fix sync per selected products ---
  app.post("/api/locations/fix-sync-batch", requireAdmin, async (req, res) => {
    const { productIds, direction } = req.body ?? {};
    if (!Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ error: "Brak productIds" });
      return;
    }

    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostępny" });
      const locationField = await getLocationField();

      if (direction === "postgres-to-subiekt") {
        const plRows = await db
          .select({ productId: schema.productLocations.productId, code: schema.locations.code })
          .from(schema.productLocations)
          .innerJoin(schema.locations, eq(schema.productLocations.locationId, schema.locations.id));
        const map = new Map<number, string[]>();
        for (const r of plRows) {
          if (productIds.includes(r.productId)) {
            const list = map.get(r.productId) || [];
            list.push(r.code);
            map.set(r.productId, list);
          }
        }
        let fixed = 0;
        for (const [id, codes] of map) {
          await pool
            .request()
            .input("id", id)
            .input("val", codes.join(","))
            .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);
          fixed++;
        }
        res.json({ ok: true, fixed });
      } else if (direction === "subiekt-to-postgres") {
        // Re-sync from Subiekt for selected products
        let imported = 0;
        for (const id of productIds) {
          const [current] = await db
            .select()
            .from(schema.productLocations)
            .where(eq(schema.productLocations.productId, id));
          const subiektRow = await pool
            .request()
            .input("id", id)
            .query(`SELECT ${locationField} AS val FROM tw__Towar WHERE tw_Id = @id`);
          const codes = ((subiektRow.recordset[0] as SubiektFieldRow | undefined)?.val || "")
            .split(/[,;]/)
            .map((s: string) => s.trim())
            .filter(Boolean);
          if (current)
            await db
              .delete(schema.productLocations)
              .where(eq(schema.productLocations.productId, id));
          for (const code of codes) {
            const [loc] = await db
              .select()
              .from(schema.locations)
              .where(eq(schema.locations.code, code));
            if (loc) {
              await db
                .insert(schema.productLocations)
                .values({ productId: id, locationId: loc.id, quantity: 1 })
                .onConflictDoNothing();
              imported++;
            }
          }
        }
        res.json({ ok: true, imported });
      } else if (direction === "clear") {
        for (const id of productIds) {
          await pool
            .request()
            .input("id", id)
            .query(`UPDATE tw__Towar SET ${locationField} = '' WHERE tw_Id = @id`);
          await db.delete(schema.productLocations).where(eq(schema.productLocations.productId, id));
        }
        res.json({ ok: true, cleared: productIds.length });
      }
    } catch (err) {
      logger.error({ err }, "Batch fix failed");
      res.status(500).json({ error: "Nie udało się" });
    }
  });

  // --- Reset: wszystkie lokalizacje produktu → tylko ta jedna ---
  app.post("/api/locations/reset", requireAdmin, async (req, res) => {
    const { codes, location } = req.body ?? {};
    if (!Array.isArray(codes) || !location) {
      res.status(400).json({ error: "Brak kodów lub lokalizacji" });
      return;
    }
    const { parseLocation } = await import("../../lib/locations.js");
    const parsed = parseLocation(location);
    if (!parsed) {
      res.status(422).json({ error: "Nieprawidlowy format" });
      return;
    }
    try {
      const db = getDb();
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();
      if (!pool) return res.status(503).json({ error: "MSSQL niedostepny" });
      const locationField = await getLocationField();
      let [loc] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.code, parsed.raw));
      if (!loc) {
        [loc] = await db
          .insert(schema.locations)
          .values({
            code: parsed.raw,
            area: parsed.area,
            aisle: parsed.aisle,
            rack: parsed.rack,
            shelf: parsed.shelf,
            spot: parsed.spot,
            label: parsed.label,
          })
          .returning();
      }
      let reset = 0;
      const operatorName = await getOperatorName(req.user?.subiektUzId ?? 0);
      for (const code of codes) {
        const r = await pool
          .request()
          .input("code", code)
          .query(
            "SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name FROM tw__Towar WHERE tw_PodstKodKresk = @code",
          );
        for (const row of r.recordset) {
          const productId = (row as SubiektProductRow).id;
          await db
            .delete(schema.productLocations)
            .where(eq(schema.productLocations.productId, productId));
          await db
            .insert(schema.productLocations)
            .values({ productId, locationId: loc.id, quantity: 1 });
          await pool
            .request()
            .input("id", productId)
            .input("val", parsed.raw)
            .query(`UPDATE tw__Towar SET ${locationField} = @val WHERE tw_Id = @id`);
          await db.insert(schema.productMovements).values({
            productId,
            symbol: (row as SubiektProductRow).symbol,
            name: (row as SubiektProductRow).name,
            toLocationId: loc.id,
            toCode: parsed.raw,
            quantity: 1,
            operator: operatorName,
            correlationId: crypto.randomUUID(),
          });
          reset++;
        }
      }
      logger.info({ location: parsed.raw, reset }, "Location reset");
      res.json({ ok: true, reset, location: parsed.raw });
    } catch (err) {
      logger.error({ err }, "Reset failed");
      res.status(500).json({ error: "Reset nie powiodl sie" });
    }
  });

  // --- Pełna kartoteka lokalizacji (Postgres-first, MUST be last — catches /:code) ---
  app.get("/api/locations/:code", async (req, res) => {
    const code = req.params.code as string;
    if (!code) {
      res.status(400).json({ error: "Brak kodu lokalizacji" });
      return;
    }
    try {
      const db = getDb();
      const [loc] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.code, code))
        .limit(1);
      if (!loc) {
        res.status(404).json({ error: "Lokalizacja nie znaleziona" });
        return;
      }

      const plRows = await db
        .select({
          productId: schema.productLocations.productId,
          quantity: schema.productLocations.quantity,
        })
        .from(schema.productLocations)
        .where(eq(schema.productLocations.locationId, loc.id));
      const productIds = plRows.map((r) => r.productId);
      const quantityMap = new Map<number, number>();
      for (const r of plRows) quantityMap.set(r.productId, r.quantity ?? 1);
      const totalQuantity = [...quantityMap.values()].reduce((s, q) => s + q, 0);

      let cachedProducts: {
        id: number;
        symbol: string;
        name: string;
        barcode: string | null;
        unit: string | null;
      }[] = [];
      if (productIds.length > 0) {
        cachedProducts = await db
          .select()
          .from(schema.productsCache)
          .where(inArray(schema.productsCache.id, productIds));
      }
      const cachedIds = new Set(cachedProducts.map((p) => p.id));
      const missingIds = productIds.filter((id) => !cachedIds.has(id));

      if (missingIds.length > 0) {
        const adapter = getAdapter();
        const pool = await adapter.getPool?.();
        if (pool) {
          const placeholders = missingIds.map((_, i) => `@id${i}`);
          const req2 = pool.request();
          missingIds.forEach((id, i) => req2.input(`id${i}`, id));
          const mssqlResult = await req2.query(
            `SELECT tw_Id AS id,tw_Symbol AS symbol,tw_Nazwa AS name,tw_PodstKodKresk AS barcode,tw_JednMiary AS unit FROM tw__Towar WHERE tw_Id IN (${placeholders.join(",")})`,
          );
          for (const row of mssqlResult.recordset) {
            const r = row as {
              id: number;
              symbol: string;
              name: string;
              barcode: string | null;
              unit: string | null;
            };
            cachedProducts.push(r);
            try {
              await db
                .insert(schema.productsCache)
                .values({
                  id: r.id,
                  symbol: r.symbol,
                  name: r.name,
                  barcode: r.barcode || null,
                  unit: r.unit || "szt",
                })
                .onConflictDoUpdate({
                  target: schema.productsCache.id,
                  set: {
                    symbol: r.symbol,
                    name: r.name,
                    barcode: r.barcode || null,
                    unit: r.unit || "szt",
                    updatedAt: sql`now()`,
                  },
                });
            } catch {
              /* ok */
            }
          }
        }
      }

      const movements = await db
        .select()
        .from(schema.productMovements)
        .where(
          or(eq(schema.productMovements.fromCode, code), eq(schema.productMovements.toCode, code)),
        )
        .orderBy(sql`${schema.productMovements.createdAt} DESC`)
        .limit(20);

      const products = productIds.map((pid) => {
        const c = cachedProducts.find((p) => p.id === pid);
        return {
          productId: pid,
          symbol: c?.symbol ?? `#${pid}`,
          name: c?.name ?? "Nieznany",
          barcode: c?.barcode ?? "",
          unit: c?.unit ?? "szt.",
          quantity: quantityMap.get(pid) ?? 1,
        };
      });

      res.json({
        code: loc.code,
        area: loc.area,
        aisle: loc.aisle,
        rack: loc.rack,
        shelf: loc.shelf,
        productCount: productIds.length,
        totalQuantity,
        products,
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
      logger.error({ err, code }, "Location card failed");
      res.status(500).json({ error: "Błąd pobierania danych" });
    }
  });
}
