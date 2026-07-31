# TASKS — PomagierGT v1.6.0

---

# TASKS — Sprint 3: Login flow fix (2026-07-31)

| Data       | Zadanie                                                                                          | Status |
| ---------- | ------------------------------------------------------------------------------------------------ | ------ |
| 2026-07-31 | Diagnoza: /api/users + /api/warehouses zwracają 401, wizard ma 5 endpointów z requireAdmin       | ✅     |
| 2026-07-31 | Branch `fix/wizard-public-and-pin-default` z main                                                | ✅     |
| 2026-07-31 | Zmiana: PUBLIC_PATHS (+6 endpointów) w `src/api/auth-middleware.ts`                              | ✅     |
| 2026-07-31 | Refaktor: `wizard.ts` — skip param, default PIN 0000, return pins, zdejmij requireAdmin        | ✅     |
| 2026-07-31 | Zmiana: `seed.ts` — `generatePin() { return "0000" }`                                            | ✅     |
| 2026-07-31 | Nowy test: `tests/unit/auth-middleware.test.ts` (11 public + 3 protected + 2 path matching)     | ✅     |
| 2026-07-31 | Nowy test: `tests/unit/routes/wizard-skip.test.ts` (5 scenariuszy skip + PIN)                    | ✅     |
| 2026-07-31 | Weryfikacja: typecheck ✅ / lint 0/0 / test 132/132 (+22)                                        | ✅     |
| 2026-07-31 | CHANGELOG, SECURITY (Phase 2 hardening plan), TASKS                                              | ✅     |
| 2026-07-31 | `npm run build:api` + `sudo systemctl restart pomagier-api`                                      | ✅     |
| 2026-07-31 | Wykonanie wizard: POST /api/wizard/import-all?skip=locations,productLocations (13 userów)         | ✅     |
| 2026-07-31 | Weryfikacja Postgres users (SELECT 13 rows, PIN 0000 bcrypt)                                      | ✅     |
| 2026-07-31 | Merge fast-forward do main + push origin                                                          | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 132/132 (+22 nowe) | **Branch**: `fix/wizard-public-and-pin-default` → merged to `main`

---

# TASKS — PomagierGT v1.6.0
| ---------- | --------------------------------------------------------------------------------------------------- | ----------- |
| 2026-07-30 | Kartoteka produktu — nowy endpoint code/:code + taby Stany/Lokalizacje/Ruchy + tools + paski stanów | ✅          |
| 2026-07-30 | Kartoteka lokalizacji — nowy endpoint + taby Produkty/Ruchy + tools modal                           | ✅          |
| 2026-07-30 | Koszyk skanów — przebudowa /mobile/scan z pojedynczego wyniku na listę                              | ✅          |
| 2026-07-30 | Tabela products_cache w Postgres + migracja                                                         | ✅          |
| 2026-07-30 | Endpoint POST /api/scan-basket — Postgres-first, MSSQL fallback                                     | ✅          |
| 2026-07-30 | ScanBasketContext — stan koszyka w layoucie /mobile                                                 | ✅          |
| 2026-07-30 | Back-buttony w kartotekach product.$code i location.$code                                           | ✅          |
| 2026-07-30 | Ujednolicenie headera koszyka (BasketHeader component)                                              | ✅          |
| 2026-07-30 | Widoczny przycisk usuwania w wierszach koszyka                                                      | ✅          |
| 2026-07-30 | Testy: +15 (endpointy + context), 30 plików                                                         | ✅          |
| 2026-07-30 | Build: ✅                                                                                           | Lint: 0E/0W | Tests: 101/102 (1 pre-existing) | ✅  |

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
