# TASKS — Sprint 17: Pełne czyszczenie lokalizacji (2026-08-05)

| Data       | Zadanie                                                       | Status |
| ---------- | ------------------------------------------------------------- | ------ |
| 2026-08-05 | Admin-only tryb „Wyczyść lokalizacje” w `/mobile/locations` | ✅     |
| 2026-08-05 | `POST /api/locations/clear` z retry i kompensacją             | ✅     |
| 2026-08-05 | Audyt `location.cleared` i ruchy bez lokalizacji docelowej   | ✅     |
| 2026-08-05 | Testy, lint, typecheck i build                                | ✅     |

**Testy:** 301 pass / 6 skip.

---

# TASKS — Sprint 15: Centralna wersja aplikacji (2026-08-03)

| Data       | Zadanie                                                       | Status |
| ---------- | ------------------------------------------------------------- | ------ |
| 2026-08-03 | Jedno źródło wersji: `package.json` + Vite define             | ✅     |
| 2026-08-03 | Wersja w `/admin`, `/mobile`, `/admin/login`, `/mobile/login` | ✅     |
| 2026-08-03 | Testy, lint, typecheck i build                                | ✅     |

**Wersja:** v1.10.6 w kodzie i release tag v1.10.6.

---

# TASKS — Sprint 16: Sync monitor correction (2026-08-03)

| Data       | Zadanie                                                    | Status |
| ---------- | ---------------------------------------------------------- | ------ |
| 2026-08-03 | Weryfikacja schematu MSSQL `tw__Towar` przez MCP           | ✅     |
| 2026-08-03 | Zamiana błędnego `tw_CzasM` na `tw_ZmianaTw.twz_CzasModyf` | ✅     |
| 2026-08-03 | Poprawa progu `memory.warning` względem limitu V8 heap     | ✅     |
| 2026-08-03 | Testy, build API, restart i health check ERP               | ✅     |

**Wersja:** v1.10.6. **Testy:** 297 pass / 6 skip.

---

# TASKS — Sprint 14: Admin stats analytics (2026-08-03)

| Data       | Zadanie                                                 | Status |
| ---------- | ------------------------------------------------------- | ------ |
| 2026-08-03 | `/admin/stats`: taby Operacje magazynowe / System i ERP | ✅     |
| 2026-08-03 | Dynamiczny zakres: dzisiaj / 7 dni / 30 dni             | ✅     |
| 2026-08-03 | Auto-refresh + status MSSQL/ERP/synchronizacji          | ✅     |
| 2026-08-03 | Wykresy, KPI, ostatnie ruchy i szybkie akcje            | ✅     |
| 2026-08-03 | Typecheck, lint, testy, build                           | ✅     |

**Testy:** 297 pass / 6 skip. **Tag:** v1.10.4.

---

# TASKS — Sprint 10: comprehensive logging backlog (2026-08-01)

| Data       | Zadanie                                                                    | Status |
| ---------- | -------------------------------------------------------------------------- | ------ |
| 2026-08-01 | Branch `fix/sprint-10-backlog` z main                                      | ✅     |
| 2026-08-01 | T1+T2: idempotency.ts — actorSubiektUzId + 3 callerów w locations.ts (TDD) | ✅     |
| 2026-08-01 | T3: admin.logs.tsx — usunięcie dead `warehouses` query                     | ✅     |
| 2026-08-01 | T4: system-monitor.ts — `void err` → idiomatic catch                       | ✅     |
| 2026-08-01 | T5: Docs + tag v1.9.1                                                      | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 222/222 (+2) | **Branch**: `fix/sprint-10-backlog` → merged to `main`

---

# TASKS — Sprint 9: queue.conflict + actor (2026-08-01)

| Data       | Zadanie                                                               | Status |
| ---------- | --------------------------------------------------------------------- | ------ |
| 2026-08-01 | Branch `feat/sprint-9-queue-conflict-actor` z main                    | ✅     |
| 2026-08-01 | T1+T2: offline-queue.ts — queue.conflict (409) + actorSubiektUzId     | ✅     |
| 2026-08-01 | T3: Callerzy — mobile.scan.tsx, mobile.locations.tsx, mobile.sync.tsx | ✅     |
| 2026-08-01 | T4: Testy (queue.conflict + actor) — 6 testów                         | ✅     |
| 2026-08-01 | T5: Docs + tag v1.9.0                                                 | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 220/220 (+6) | **Branch**: `feat/sprint-9-queue-conflict-actor` → merged to `main`

---

# TASKS — Sprint 8: queue + system + fixy (2026-08-01)

| Data       | Zadanie                                                                          | Status |
| ---------- | -------------------------------------------------------------------------------- | ------ |
| 2026-08-01 | Branch `feat/sprint-8-queue-system-fixy` z main                                  | ✅     |
| 2026-08-01 | T1+T2: offline-queue.ts — logEvent queue.added + queue.replayed (TDD)            | ✅     |
| 2026-08-01 | T3: idempotency.ts — logEvent idempotency.reused                                 | ✅     |
| 2026-08-01 | T4: server.ts — logEvent startup + shutdown                                      | ✅     |
| 2026-08-01 | T5: system-monitor.ts + health.ts — memory/disk/health.fail + startSystemMonitor | ✅     |
| 2026-08-01 | T6: GET /api/logs/users + UI dropdown update                                     | ✅     |
| 2026-08-01 | T7: Modal correlation search param fix (backend + UI)                            | ✅     |
| 2026-08-01 | T8: 4 minor fixes (CSV, transactional, clearInterval, comment)                   | ✅     |
| 2026-08-01 | T9: Docs sync + tag v1.8.0                                                       | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 214/214 (+27) | **Branch**: `feat/sprint-8-queue-system-fixy` → merged to `main`

---

# TASKS — Sprint 7: Comprehensive Logging (2026-08-01)

| Data       | Zadanie                                                                        | Status |
| ---------- | ------------------------------------------------------------------------------ | ------ |
| 2026-08-01 | Design spec: docs/superpowers/specs/2026-08-01-comprehensive-logging-design.md | ✅     |
| 2026-08-01 | Branch `feat/comprehensive-logging` z main                                     | ✅     |
| 2026-08-01 | Task 1: Schema migration 0006 + Drizzle update                                 | ✅     |
| 2026-08-01 | Task 2: app-logger.ts (dual-write + maskSensitive)                             | ✅     |
| 2026-08-01 | Task 3: cleanup.ts (30-day)                                                    | ✅     |
| 2026-08-01 | Task 4: /api/logs (list, detail, export)                                       | ✅     |
| 2026-08-01 | Task 5: auth.ts uses logEvent                                                  | ✅     |
| 2026-08-01 | Task 6: scan.ts + locations.ts use logEvent                                    | ✅     |
| 2026-08-01 | Task 7: erp-config.ts + backup.ts + users.ts use logEvent                      | ✅     |
| 2026-08-01 | Task 8: mssql.adapter.ts logs slow/error                                       | ✅     |
| 2026-08-01 | Task 9: server.ts register logs + cleanup interval                             | ✅     |
| 2026-08-01 | Task 10: /admin/logs UI redesign                                               | ✅     |
| 2026-08-01 | Task 11: activity.ts uses logEvent                                             | ✅     |
| 2026-08-01 | Task 12 chore: remove duplicate manual audit_log inserts (T5 leftover)         | ✅     |
| 2026-08-01 | Task 12: Docs sync + tag v1.7.0                                                | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 187/187 (+31) | **Branch**: `feat/comprehensive-logging` → merged to `main`

---

# TASKS — PomagierGT v1.6.3 (2026-08-01)

> **v1.6.3** = Sprint 3 (chicken-and-egg fix) + Sprint 4 (global warehouses) + Sprint 5 (auto-logout 401) + Sprint 6 (warehouse in basket). 156 testów pass / 6 skip.

---

# TASKS — Sprint 3: Login flow fix (2026-07-31)

| Data       | Zadanie                                                                                     | Status |
| ---------- | ------------------------------------------------------------------------------------------- | ------ |
| 2026-07-31 | Diagnoza: /api/users + /api/warehouses zwracają 401, wizard ma 5 endpointów z requireAdmin  | ✅     |
| 2026-07-31 | Branch `fix/wizard-public-and-pin-default` z main                                           | ✅     |
| 2026-07-31 | Zmiana: PUBLIC_PATHS (+6 endpointów) w `src/api/auth-middleware.ts`                         | ✅     |
| 2026-07-31 | Refaktor: `wizard.ts` — skip param, default PIN 0000, return pins, zdejmij requireAdmin     | ✅     |
| 2026-07-31 | Zmiana: `seed.ts` — `generatePin() { return "0000" }`                                       | ✅     |
| 2026-07-31 | Nowy test: `tests/unit/auth-middleware.test.ts` (11 public + 3 protected + 2 path matching) | ✅     |
| 2026-07-31 | Nowy test: `tests/unit/routes/wizard-skip.test.ts` (5 scenariuszy skip + PIN)               | ✅     |
| 2026-07-31 | Weryfikacja: typecheck ✅ / lint 0/0 / test 132/132 (+22)                                   | ✅     |
| 2026-07-31 | CHANGELOG, SECURITY (Phase 2 hardening plan), TASKS                                         | ✅     |
| 2026-07-31 | `npm run build:api` + `sudo systemctl restart pomagier-api`                                 | ✅     |
| 2026-07-31 | Wykonanie wizard: POST /api/wizard/import-all?skip=locations,productLocations (13 userów)   | ✅     |
| 2026-07-31 | Weryfikacja Postgres users (SELECT 13 rows, PIN 0000 bcrypt)                                | ✅     |
| 2026-07-31 | Merge fast-forward do main + push origin                                                    | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 132/132 (+22 nowe) | **Branch**: `fix/wizard-public-and-pin-default` → merged to `main`

---

# TASKS — Sprint 4: Global Warehouses (2026-08-01)

| Data       | Zadanie                                                                                                        | Status |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-08-01 | Branch `refactor/global-warehouses` z main                                                                     | ✅     |
| 2026-08-01 | Faza 1: Backup users table (13 rekordów) do `/tmp/pomagier-users-backup-*.json`                                | ✅     |
| 2026-08-01 | Faza 2: Nowy endpoint `GET/PUT /api/erp/supported-warehouses` (admin, cache TTL 60s)                           | ✅     |
| 2026-08-01 | Faza 3: `/api/warehouses` filtrowanie wg `supported_warehouses` + auto-default isMain                          | ✅     |
| 2026-08-01 | Faza 4: Usunięcie `PUT /api/users/:subiektId/warehouse` (404)                                                  | ✅     |
| 2026-08-01 | Faza 5: `scan.ts` — warehouse w body + walidacja wg supported                                                  | ✅     |
| 2026-08-01 | Faza 6: Czyszczenie `warehouseId` z auth/users responses + `req.user.warehouseId`                              | ✅     |
| 2026-08-01 | Faza 7: Migracja `0005_drop_user_warehouse.sql` + aktualizacja schema.ts + journal                             | ✅     |
| 2026-08-01 | Faza 8: Frontend - nowa sekcja "Obsługiwane magazyny" w `admin.erp.tsx`                                        | ✅     |
| 2026-08-01 | Faza 9: Frontend - usunięcie kolumny "Magazyn" + mutacji z `admin.users.tsx`                                   | ✅     |
| 2026-08-01 | Faza 10: Frontend - `ScanHeader` + `useScanInput` + strony skanują - warehouse w body                          | ✅     |
| 2026-08-01 | Faza 11: Frontend - `lib/auth.tsx` — `AuthWarehouse {id, symbol}` + migracja localStorage                      | ✅     |
| 2026-08-01 | Faza 12: Testy - nowe `erp-supported-warehouses.test.ts` (6) + update `scan.test.ts` (4) + `users.test.ts` (3) | ✅     |
| 2026-08-01 | Faza 13: Weryfikacja - typecheck ✅ / lint 0/0 / test 143/143 (+11)                                            | ✅     |
| 2026-08-01 | Faza 14: Dokumentacja - CHANGELOG, DB_SCHEMA, API, SECURITY                                                    | ✅     |
| 2026-08-01 | Faza 15: build:api + restart + smoke test (login, /warehouses, /erp/supported, scan) + commit + merge + push   | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 143/143 (+11 nowe) | **Branch**: `refactor/global-warehouses` → merged to `main`

---

# TASKS — Sprint 6: warehouse in basket (regression fix) (2026-08-01)

| Data       | Zadanie                                                                                           | Status |
| ---------- | ------------------------------------------------------------------------------------------------- | ------ |
| 2026-08-01 | Diagnoza: koszyk w /mobile/locations bez nazwy i stanów (po Sprint 4)                             | ✅     |
| 2026-08-01 | Branch `fix/warehouse-in-basket-calls` z main                                                     | ✅     |
| 2026-08-01 | Fix 1: `src/hooks/use-basket.ts` — `lookupProduct(code, warehouseId)` z auth context              | ✅     |
| 2026-08-01 | Fix 2: `src/routes/mobile.locations.tsx` — lookupProduct z `auth.warehouse?.id`                   | ✅     |
| 2026-08-01 | Fix 3: `src/lib/offline-queue.ts` — `QueuedScan.warehouse?` + addScanToQueue + replay z warehouse | ✅     |
| 2026-08-01 | Fix 4: `src/routes/mobile.scan.tsx` — addScanToQueue z warehouse?.id                              | ✅     |
| 2026-08-01 | Nowy test: `tests/unit/use-basket.test.tsx` (3 testy: warehouse w body, fallback, dedupe)         | ✅     |
| 2026-08-01 | Weryfikacja: typecheck ✅ / lint 0/0 / test 146/146 (+3)                                          | ✅     |
| 2026-08-01 | Build:api + restart + smoke test (login, /warehouses, /erp/supported, scan)                       | ✅     |
| 2026-08-01 | Commit + merge + push                                                                             | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 146/146 (+3) | **Branch**: `fix/warehouse-in-basket-calls` → merged to `main`

---

# TASKS — Sprint 5: Auto-logout on session expiry (2026-08-01)

| Data       | Zadanie                                                                                         | Status |
| ---------- | ----------------------------------------------------------------------------------------------- | ------ |
| 2026-08-01 | Diagnoza: brak globalnej obsługi 401 (tylko page-specific w admin.erp.tsx)                      | ✅     |
| 2026-08-01 | Branch `fix/auto-logout-on-401` z main                                                          | ✅     |
| 2026-08-01 | Nowy: `src/lib/use-401-redirect.ts` — globalny 401 handler (subskrybuje QueryCache)             | ✅     |
| 2026-08-01 | Refaktor: `src/lib/use-auto-logout.ts` — parametr `redirectTo` (admin vs mobile path)           | ✅     |
| 2026-08-01 | `src/routes/admin.tsx` — `useAutoLogout(30, "/admin/login")` + `use401Redirect("/admin/login")` | ✅     |
| 2026-08-01 | `src/routes/mobile.tsx` — `use401Redirect("/mobile/login")`                                     | ✅     |
| 2026-08-01 | `src/components/pomagier/MobileShell.tsx` — explicit `useAutoLogout(15, "/mobile/login")`       | ✅     |
| 2026-08-01 | `src/routes/admin.erp.tsx` — usunięty page-specific 401 redirect (globalny hook wystarczy)      | ✅     |
| 2026-08-01 | Nowy test: `tests/unit/use-401-redirect.test.tsx` (6 testów)                                    | ✅     |
| 2026-08-01 | Nowy test: `tests/unit/use-auto-logout.test.tsx` (4 testy)                                      | ✅     |
| 2026-08-01 | Weryfikacja: typecheck ✅ / lint 0/0 / test 156/156 (+10)                                       | ✅     |
| 2026-08-01 | Build + restart + commit + merge + push                                                         | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 156/156 (+10) | **Branch**: `fix/auto-logout-on-401` → merged to `main`

---

# TASKS — PomagierGT v1.6.0

| ---------- | --------------------------------------------------------------------------------------------------- | ----------- |
| 2026-07-30 | Kartoteka produktu — nowy endpoint code/:code + taby Stany/Lokalizacje/Ruchy + tools + paski stanów | ✅ |
| 2026-07-30 | Kartoteka lokalizacji — nowy endpoint + taby Produkty/Ruchy + tools modal | ✅ |
| 2026-07-30 | Koszyk skanów — przebudowa /mobile/scan z pojedynczego wyniku na listę | ✅ |
| 2026-07-30 | Tabela products_cache w Postgres + migracja | ✅ |
| 2026-07-30 | Endpoint POST /api/scan-basket — Postgres-first, MSSQL fallback | ✅ |
| 2026-07-30 | ScanBasketContext — stan koszyka w layoucie /mobile | ✅ |
| 2026-07-30 | Back-buttony w kartotekach product.$code i location.$code | ✅ |
| 2026-07-30 | Ujednolicenie headera koszyka (BasketHeader component) | ✅ |
| 2026-07-30 | Widoczny przycisk usuwania w wierszach koszyka | ✅ |
| 2026-07-30 | Testy: +15 (endpointy + context), 30 plików | ✅ |
| 2026-07-30 | Build: ✅ | Lint: 0E/0W | Tests: 101/102 (1 pre-existing) | ✅ |

---

# TASKS — Tech debt cleanup (2026-07-31)

| Data       | Zadanie                                                                            | Status |
| ---------- | ---------------------------------------------------------------------------------- | ------ |
| 2026-07-31 | Branch `chore/tech-debt-cleanup` z `main` (working tree czysty)                    | ✅     |
| 2026-07-31 | FIX 1: Dodane skrypty `test` + `test:watch` w `package.json`                       | ✅     |
| 2026-07-31 | FIX 1: Weryfikacja — `npm test` uruchamia 110/110 (6 skip)                         | ✅     |
| 2026-07-31 | FIX 2: Usunięty deprecated `vite-tsconfig-paths` → natywny `resolve.tsconfigPaths` | ✅     |
| 2026-07-31 | FIX 2: Weryfikacja — brak ostrzeżenia pluginu, testy zielone                       | ✅     |
| 2026-07-31 | FIX 3: Dodane brakujące deps w `ScanHeader.tsx` (×2) i `use-scan-input.ts` (×1)    | ✅     |
| 2026-07-31 | FIX 3: Weryfikacja — `npm run lint` 0/0, typecheck OK, testy zielone               | ✅     |
| 2026-07-31 | Weryfikacja finalna: `npm run build` (PWA 3.48s) + `npm run build:api`             | ✅     |
| 2026-07-31 | CHANGELOG.md: dodana sekcja "Tech debt cleanup"                                    | ✅     |
| 2026-07-31 | 3 commity na branchu `chore/tech-debt-cleanup` (1 chore + 1 chore + 1 fix)         | ✅     |

**Następny krok**: Decyzja użytkownika (Q1 + Q2) → PLAN v0 dla wybranego modułu (inwentaryzacja / kompletacja / przyjęcie dostaw / przesunięcia / zadania).

---

# TASKS — PomagierGT v1.5.0 (archived)

| Data       | Zadanie                                                       | Status        |
| ---------- | ------------------------------------------------------------- | ------------- |
| 2026-07-29 | Frontend lint-zero: 0 błędów (było ~40), 3 ostrzeżenia        | ✅            |
| 2026-07-29 | admin.map.tsx: 662→56 linii, 7 komponentów, useMapData hook   | ✅            |
| 2026-07-29 | admin.erp.tsx: 434→121 linii, 3 komponenty, useErpConfig hook | ✅            |
| 2026-07-29 | ScanHeader: wydzielony useScanInput hook                      | ✅            |
| 2026-07-29 | Testy: RTL + jsdom, 10 render tests (85 total, 26 plików)     | ✅            |
| 2026-07-29 | E2E: Playwright, 3 scenariusze                                | ✅            |
| 2026-07-29 | Build: ✅                                                     | Typecheck: ✅ | Lint: 0E/3W | Tests: 85/85 | ✅  |

---

# TASKS — PomagierGT v1.4.0 (archived)

| Data       | Zadanie                                                                                         | Status                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2026-07-29 | MobileShell: header redesign — colored icon square + avatar + queue/warehouse/connection badges | ✅                                                                                 |
| 2026-07-29 | MobileShell: avatar profile modal (centered, dark mode, warehouse, queue, logout, version)      | ✅                                                                                 |
| 2026-07-29 | MobileShell: Sync tab icon color (green/amber/red) based on connection + queue status           | ✅                                                                                 |
| 2026-07-29 | MobileShell: dynamic page title from route path (titleMap)                                      | ✅                                                                                 |
| 2026-07-29 | Mobile login: PIN in Dialog modal + vertical centering + 40px top padding                       | ✅                                                                                 |
| 2026-07-29 | BasketPanel: global redesign — 2-column layout, AlertDialog for qty=1, color +/- buttons        | ✅                                                                                 |
| 2026-07-29 | BasketPanel: beep + haptic on +/- buttons                                                       | ✅                                                                                 |
| 2026-07-29 | BasketPanel: lazy-fetch stock info in modal on row click (per-warehouse quantities)             | ✅                                                                                 |
| 2026-07-29 | BasketPanel: shared component used by /mobile/inventory + /mobile/locations                     | ✅                                                                                 |
| 2026-07-29 | Sync page: full redesign — pending scans list, Sync/Stop/Clear, per-item results                | ✅                                                                                 |
| 2026-07-29 | Offline queue: replayQueue with AbortSignal, removeSingleScan, per-item ReplayItem[]            | ✅                                                                                 |
| 2026-07-29 | ScanHeader: removed pageTitle/pageSubtitle — title now in MobileShell header                    | ✅                                                                                 |
| 2026-07-29 | ScanHeader: removed "Powtórz ostatni", "Ostatnie kody", "Kolejka offline", "Wyczyść historię"   | ✅                                                                                 |
| 2026-07-29 | ScanHeader: hidden camera scanner option                                                        | ✅                                                                                 |
| 2026-07-29 | ScanHeader: sticky height matches MobileShell with smooth transition (IntersectionObserver)     | ✅                                                                                 |
| 2026-07-29 | Locations: removed "Przypisz do ostatniej lokalizacji" button                                   | ✅                                                                                 |
| 2026-07-29 | Locations: post-save result modal (product list confirmation, replaced stock verification card) | ✅                                                                                 |
| 2026-07-29 | ERP: location separator migration `,` → `,` in tw_Pole1..tw_Pole8 (MSSQL REPLACE)               | ✅                                                                                 |
| 2026-07-29 | ERP: dual-read split(/[,;]/) + write join(",") for backward compatibility                       | ✅                                                                                 |
| 2026-07-29 | PWA: auto-reload on new Service Worker (controllerchange listener)                              | ✅                                                                                 |
| 2026-07-29 | DevOps: MSSQL MCP pinned mcp>=1.0,<2.0 for Python 3.14 compatibility                            | ✅                                                                                 |
| 2026-07-29 | Build: ✅                                                                                       | Lint: ✅ clean (API-layer), 40 pre-existing warnings only in frontend shadcn/admin | ✅  |

---

# TASKS — PomagierGT v1.4.0

| Data       | Zadanie                                                                    | Status |
| ---------- | -------------------------------------------------------------------------- | ------ |
| 2026-07-29 | Refaktoryzacja API: podział server.ts na 14 modułów tras w src/api/routes/ | ✅     |
| 2026-07-29 | Nowy system błędów: ApiError + errorHandler middleware                     | ✅     |
| 2026-07-29 | Walidacja Zod (validate middleware) dla wszystkich endpointów z body       | ✅     |
| 2026-07-29 | Jawne typy MSSQL (types.ts) — usunięcie `any` z warstwy API                | ✅     |
| 2026-07-29 | server.ts zredukowany z 1314 → ~150 linii                                  | ✅     |
| 2026-07-29 | Testy: 65 testów (15 istniejących + 50 nowych), 18 plików                  | ✅     |
| 2026-07-29 | Coverage v8 skonfigurowany                                                 | ✅     |
| 2026-07-29 | Lint: 40 błędów (tylko frontend, poza zakresem), 0 błędów w API            | ✅     |
| 2026-07-29 | Dokumentacja: README, CHANGELOG, TASKS zaktualizowane                      | ✅     |

---

# TASKS — PomagierGT v1.2.0 (archived)

| Data       | Zadanie                                                                               | Status |
| ---------- | ------------------------------------------------------------------------------------- | ------ |
| 2026-07-28 | ScanHeader: unified scan input component (sticky, flash, autocomplete, tools, camera) | ✅     |
| 2026-07-28 | ScanHeader: inputmode="none" — no Android keyboard on scanner terminals               | ✅     |
| 2026-07-28 | ScanHeader: tools modal — repeat last, manual toggle, camera scanner, recent codes    | ✅     |
| 2026-07-28 | ScanHeader: haptic feedback + scanBus integration                                     | ✅     |
| 2026-07-28 | Refactor /mobile/scan → ScanHeader                                                    | ✅     |
| 2026-07-28 | Refactor /mobile/locations → ScanHeader                                               | ✅     |
| 2026-07-28 | Refactor /mobile/inventory → ScanHeader                                               | ✅     |
| 2026-07-28 | Remove old ScanInput.tsx                                                              | ✅     |
| 2026-07-28 | New: useRecentCodes.ts hook + haptic() utility                                        | ✅     |
