---
name: location-sync
description: Use when working with location code sync between PomagierGT (Postgres + Subiekt GT MSSQL). Covers code format, normalization, dual-write compensation, timestamp-based change detection, common pitfalls (varchar 50 overflow, etc.). Triggers on: location code, location sync, tw_Pole1, verify-sync, subiekt-changes, SyncStatusBadge, parseLocation, location assignment.
---

# Location Code Sync — PomagierGT ↔ Subiekt GT

Ten skill dokumentuje best practices i gotchas dla lokalizacji towarów (location codes) przechowywanych w Postgres (Pomagier) i Subiekt GT (MSSQL, `tw_Pole1`).

## Format lokalizacji

- **Postgres**: `locations` table - code `varchar(30) UNIQUE NOT NULL` + structured columns (area, aisle, rack, shelf, spot)
- **Subiekt**: `tw__Towar.tw_Pole1` - `varchar(50)`, przechowuje wiele kodów rozdzielonych `,` lub `;`
- **Format kodu**: `^[A-Z]\s*\d+-\d+-\d+-\d+$` (case-insensitive w `parseLocation`)
  - Przykłady: `A 1-2-3-4`, `B 5-1-1-1`
  - "Spot" zawsze 1 (per `lib/locations.ts:29`)

## Helpers (src/lib/locations.ts)

- `parseLocation(input: string): { area, aisle, rack, shelf, spot, raw, label } | null` - parsuje + normalizuje (case-insensitive, trim)
- `safeSubiektValue(codes: string[]): string` - jeśli `join(",")` > 50 znaków, rzuca error (NIE truncate)
- `isMalformedCode(code: string): boolean` - centralna definicja "malformed" (używana przez /admin/verify UI)
- `formatLocation(parsed): string` - canonical format
- `sortLocations(locations): sorted` - sort by area → aisle → rack → shelf
- `parseLocationField(field: string): string[]` - split Subiekt `tw_Pole1` na pojedyncze kody (`,` lub `;`)

## Kiedy pomagier TWORZY nowy kod vs tylko go zapisuje

- `parseLocation` NIGDY nie tworzy - tylko parsuje
- Nowe rows auto-created w `locations` gdy `parsed.raw` nie istnieje (assign, transfer, reset, import, fix-sync-batch subiekt-to-postgres, sync, wizard import-all)

## Dual-write compensation (DECISIONS.md #9)

Pomagier utrzymuje Postgres + Subiekt w sync. Na Subiekt failure:

- `assign` - rollback: DELETE postgres row, re-throw
- `transfer` - rollback: re-insert old product_locations
- `reset` - rollback: re-insert cleared product_locations
- `undo` - rollback: also delete from Subiekt (re-read after postgres delete)

Wszystkie Subiekt writes używają `writeSubiektWithRetry()` (3 attempts: 100/200/400ms).

## Common pitfalls (B1-B4 from Sprint 11 audit)

- **B1 Subiekt varchar(50) overflow**: 4+ kodów długości 12-13 znaków overflow → silent truncate or 500. ZAWSZE używaj `safeSubiektValue()`.
- **B2 transfer/reset compensation**: uszkodzone PRZED Sprint 11 (fixed)
- **B3 fix-sync-batch subiekt-to-postgres destructive delete**: uszkodzone (fixed in Sprint 11 - diff-based merge)
- **B4 reset no retry**: uszkodzone (fixed)

## Timestamp-based change detection (Sprint 11)

W tej konkretnej bazie Subiekt `tw__Towar` **nie ma `tw_CzasM`**. Historia zmian towaru jest w `tw_ZmianaTw` (`twz_TowarId`, `twz_NrZmiany`, `twz_CzasModyf datetime`). `twz_CzasModyf` jest PRE-FILTEREM zmian, nie dowodem zmiany samego `tw_Pole1`.

- `src/lib/subiekt-sync-monitor.ts` - co 5 min sprawdza `MAX(tw_ZmianaTw.twz_CzasModyf)` i loguje `system.subiekt.modified` z count + lastSyncAt + nowSubiektMax
- `config.subiekt_last_sync_at` - cursor (ISO timestamp) do śledzenia ostatniej kontroli
- `GET /api/locations/subiekt-changes?since=ISO` - returns modified products od danego timestampa
- `SyncStatusBadge` w /admin/verify - poll co 30s, badge z "X produktów zmienionych" + "Sync teraz" button
- `POST /api/locations/fix-sync-batch` direction=subiekt-to-postgres - atomic diff-based merge (NIE delete+insert)

## Bootstrap strategy (clock-skew safety)

First tick (when `subiekt_last_sync_at` IS NULL):

- Sets cursor to `(SELECT MAX(twz_CzasModyf) FROM tw_ZmianaTw)` - Subiekt's clock, NOT Pomagier's Date.now()
- Avoids marking all old records as "modified" on first run

## Normalization (idempotent)

`POST /api/locations/normalize` - normalizuje BOTH sides:

- Adds space after area (`A1-2-3-4` → `A 1-2-3-4`)
- Dedupes (uses Set)
- Wraps Postgres updates w `db.transaction`
- Subiekt update is best-effort (logged if fails)
- Idempotent: running twice gives same result

## Endpoint quick reference

| Method | Path                                     | Purpose                                                                  |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------ |
| GET    | /api/locations                           | List locations (filtered by area)                                        |
| POST   | /api/locations/assign                    | Assign products to location (with dual-write rollback)                   |
| POST   | /api/locations/transfer                  | Move products between locations (with rollback)                          |
| POST   | /api/locations/reset                     | Clear location (with rollback + retry)                                   |
| POST   | /api/locations/undo                      | Reverse last operation (compensates Subiekt)                             |
| GET    | /api/locations/verify-sync               | Postgres vs Subiekt comparison (totals only)                             |
| GET    | /api/locations/verify-sync-detail        | Paginated, filterable (area/status/q/malformed)                          |
| GET    | /api/locations/subiekt-changes?since=ISO | Modified products since timestamp (Sprint 11+)                           |
| POST   | /api/locations/fix-sync-batch            | Per-product sync (subiekt-to-postgres diff merge OR postgres-to-subiekt) |
| POST   | /api/locations/normalize                 | Idempotent format normalization                                          |
| POST   | /api/locations/clear-field               | Zero out Subiekt field + remove from product_locations                   |
| GET    | /api/locations/stats                     | Aggregations by area                                                     |
| GET    | /api/locations/grid                      | Map data grouped by (area, aisle, shelf)                                 |
| GET    | /api/locations/empty                     | Locations with no products                                               |
| GET    | /api/locations/duplicates                | Same-area, distant-aisle duplicates                                      |
| GET    | /api/locations/:code                     | Single location detail                                                   |
| POST   | /api/locations/sync                      | Full rebuild product_locations from Subiekt (transactional)              |

## Performance considerations

- Subiekt queries use `WITH (NOLOCK)` for read-only (no table lock)
- `subiekt-changes` endpoint limits to 500 rows
- `subiekt-sync-monitor` throttled to 5min
- `SyncStatusBadge` polls 30s
- All Postgres `code` queries hit `idx_locations_code` (UNIQUE creates index)
- All audit_log queries hit composite indexes from Sprint 7

## Related skills

- `subiekt-gt` - general Subiekt schema, MSSQL access patterns
- `sprint-doc-sync` - workflow after each sprint
