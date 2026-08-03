# CHANGELOG — PomagierGT

## [Unreleased]

_(brak zmian oczekujących na release)_

## [v1.10.5] — 2026-08-03 (centralna wersja aplikacji)

- Wersja aplikacji jest pobierana z `package.json` podczas builda Vite.
- Aktualna wersja `v1.10.5` jest widoczna w panelu admina, mobile oraz na ekranach logowania.
- Usunięto rozjazdy starych wersji `v1.0.0` i `v1.2.0`.

## [v1.10.4] — 2026-08-03 (Stats analytics refresh)

- Przebudowany `/admin/stats` z tabami **Operacje magazynowe** oraz **System i ERP**.
- Dynamiczny zakres statystyk: dzisiaj / 7 dni / 30 dni.
- Auto-refresh co 30 sekund z możliwością wyłączenia.
- Wykres ruchów lokalizacji, KPI, status MSSQL, logi, błędy i zmiany lokalizacji Subiekt.
- Szybkie przejścia do weryfikacji, logów i konfiguracji ERP.
- Testy: 297 pass / 6 skip.

## [v1.10.1] — 2026-08-02 (Sprint 12: cleanup + map badge)

### Fixes

- **49 pre-existing prettier errors** in test files (`tests/**/*.ts(x)`) and `src/api/routes/locations.ts` — auto-fixed with `prettier --fix`. 0 lint errors.

### Features

- **SyncStatusBadge on /admin/map** (T5.3 from Sprint 11 backlog) — admin widzi ostatnie zmiany w Subiekcie w kontekście mapy magazynowej. Klik "Sync teraz" synchronizuje Subiekt → Postgres dla zmienionych produktów i invaliduje `["grid"]` + `["empty-locs"]` queries dla automatycznego odświeżenia mapy.

### Testy

- 297 pass / 6 skip (+1 test dla MapGrid + SyncStatusBadge)

## [v1.10.0] — 2026-08-02 (Sprint 11: location sync hardening)

### New features

- **Timestamp-based Subiekt change detection** (`tw_CzasM` pre-filter):
  - `GET /api/locations/subiekt-changes?since=ISO` — returns Subiekt products modified since timestamp
  - `subiekt-sync-monitor` (cron co 5 min) — logEvent `system.subiekt.modified` with count
  - `config.subiekt_last_sync_at` — cursor (ISO timestamp) for change detection
  - Bootstrap: first tick sets cursor to `MAX(tw_CzasM)` (clock-skew safety)
- **SyncStatusBadge** w /admin/verify — poll co 30s, shows "X produktów zmienionych w Subiekcie" + "Sync teraz" button
- **New skill `location-sync`** — documents location code management, pitfalls, dual-write compensation, timestamp-based change detection

### Bug fixes (B1-B4 — real data corruption)

- **B1 Subiekt varchar(50) overflow** — `safeSubiektValue()` w `lib/locations.ts` rejects writes > 50 chars with clear error (was silent truncate / 500)
- **B2 transfer/reset dual-write compensation** — same rollback pattern as assign (was missing)
- **B3 fix-sync-batch subiekt-to-postgres safe delete** — diff-based merge (was destructive delete + re-insert)
- **B4 reset uses writeSubiektWithRetry** — consistent retry behavior

### Cleanup

- **E3 normalize de-dup** — uses Set, no more duplicate codes
- **E4 normalize transactional** — Postgres w `db.transaction`, Subiekt best-effort with logEvent
- **C3 + E8 centralize isMalformedCode** — single regex from `lib/locations.ts` shared by backend + frontend
- **E7 CHECK constraint on `product_locations.quantity > 0`** — migration 0007, pre-flight fix any quantity<=0

### Migration: 0007_product_locations_quantity_check.sql

```sql
UPDATE product_locations SET quantity = 1 WHERE quantity <= 0;
ALTER TABLE product_locations ADD CONSTRAINT chk_quantity_positive CHECK (quantity > 0);
```

### Testy (+74, total 296)

- T1: parseLocation unit tests (8 tests)
- T2: assign/transfer/reset/undo tests (7 tests, with rollback)
- T3.3: verify-sync endpoint tests (8 tests)
- T3.4: getLocationField whitelist test (4 tests, security)
- T4: subiekt-sync-monitor tests (8 tests)
- T4.3: verify-sync-detail timestamp tests (3 tests)
- T4.4: server-lifecycle tests (2 tests, subiekt sync monitor wiring)
- T5.1: SyncStatusBadge tests (4 tests)
- Inne drobne testy (29)

### Files modified

- `src/lib/locations.ts` — safeSubiektValue, isMalformedCode, parseLocation case-insensitive
- `src/api/routes/locations.ts` — overflow guards, compensation, transactional normalize, diff merge, subiekt-changes endpoint, subiektModifiedAt per row
- `src/lib/subiekt-sync-monitor.ts` — NEW (180 lines)
- `src/components/admin/SyncStatusBadge.tsx` — NEW (75 lines)
- `src/db/schema.ts` — CHECK constraint import
- `src/db/migrations/0007_product_locations_quantity_check.sql` — NEW
- `src/api/server.ts` — startSubiektSyncMonitor() wired
- `src/routes/admin.verify.tsx` — SyncStatusBadge integrated
- `.opencode/skills/location-sync/SKILL.md` — NEW

### Out of scope (deferred to backlog)

- /admin/map SyncStatusBadge (T5.3) — nice-to-have
- Auto-sync (admin-configurable) — manual sync button preferred for v1.10.0
- Per-product modification timestamp tracking — not provided by Subiekt schema

## [v1.9.1] — 2026-08-01 (Sprint 10: comprehensive logging backlog)

### Fixes

- **`actor` w `idempotency.reused`**: `checkIdempotency(key, actorSubiektUzId?)` — callerzy w `locations.ts` (3 handlery) przekazują `req.user?.subiektUzId`. Kto użył tego samego X-Idempotency-Key jest teraz widoczne w /admin/logs.

### Cleanup

- **Dead `warehouses` query w `admin.logs.tsx`**: usunięty (zastąpiony przez `/api/logs/users` w Sprint 8 T6).
- **`void err` idiom w `system-monitor.ts`**: `} catch { /* ignore */ }` (optional catch binding) + `void tick()` zamiast `tick().catch(() => {})`.

### Testy (+2, total 222)

- `idempotency.reused` z actor (2 testy: set + undefined)

## [v1.9.0] — 2026-08-01 (Sprint 9: queue.conflict + actor)

### Nowe eventy

- **`queue.conflict`** — emit przy HTTP 409 z serwera podczas replay (np. lokalizacja już istnieje). Rozróżnia conflict (permanent) od queue.replayed_failed (transient).
- **Actor w queue events** — `addScanToQueue` i `replayQueue` przyjmują `actorSubiektUzId` (nowy 4./2. parametr). Callerzy (mobile.scan.tsx, mobile.locations.tsx, mobile.sync.tsx) przekazują `auth.user?.subiektUzId`.

### Breaking changes (niskie ryzyko)

- `replayQueue(signal?, actorSubiektUzId?)` — kolejność parametrów (sygnał przesunięty na 2. miejsce, actor na 1.)
- `addScanToQueue(code, location?, warehouse?, actorSubiektUzId?)` — nowy 4. parametr (opcjonalny, backward compat)

### Testy (+6, total 220)

- queue.conflict (2 testy: 409 → emit, 500 → NOT emit)
- actor w queue events (4 testy: added, replayed_ok, replayed_failed, conflict)

### Pozostałe gapy (Sprint 10+)

- `actor w idempotency.reused` — wymaga signature change w 3 callerach (locations.ts)

## [v1.8.0] — 2026-08-01 (Sprint 8: queue + system + fixy)

Pełen coverage 6/6 kategorii eventów (auth, admin, mobile, erp, queue, system). Nowe eventy queue + system, dynamiczny dropdown użytkowników, correlation search w UI, plus 4 drobne fixy (CSV injection, transactional cleanup, clearInterval, dead import).

### Nowe kategorie eventów

- **`queue.added`** — skan dodany do IndexedDB (offline)
- **`queue.replayed_ok` / `queue.replayed_failed`** — sync po powrocie online
- **`idempotency.reused`** — stary idempotency key ponownie użyty

### Nowe eventy systemowe

- **`startup`** — API wystartowało (port, nodeVersion, pid)
- **`shutdown`** — graceful shutdown (SIGTERM/SIGINT)
- **`health.fail`** — health check zwrócił 503
- **`memory.warning`** — heap >80% (throttled co 5 min)
- **`disk.warning`** — pamięć systemowa <10% wolnego (throttled co 5 min)

### Nowe endpointy

- **`GET /api/logs/users`** — distinct `actor_subiekt_uz_id` z audit_log (dropdown w UI)

### Nowe UI

- **`?correlation=xxx`** search param w /admin/logs — auto-fill filtra z linku w modalu
- **Dynamic user dropdown** — pobiera listę z /api/logs/users zamiast hardcoded

### Fixes

- CSV injection: tab prefix dla komórek zaczynających się od `=`, `+`, `-`, `@`
- Transactional cleanup: oba DELETE w `db.transaction()`
- `clearInterval` on shutdown — czyści cleanup + system monitor handles
- `logEvent` w activity.ts — komentarz wyjaśniający fire-and-forget pattern
- `SectionTitle` unused import cleanup w admin.logs.tsx

### Testy (+27, total 214)

- queue.added, queue.replayed (6)
- idempotency.reused (3)
- system monitor memory/disk (4)
- health.fail (2)
- /api/logs/users (2)
- correlation search (4)
- CSV injection (1)
- transactional cleanup (1, +1 test update)
- clearInterval (1, +1 test update)
- admin-logs UI tests (3, first UI tests for this page)

## [v1.7.0] — 2026-08-01 (Comprehensive Logging)

Pełen audyt kto + co + jaką metodą zmienił w systemie. Dual-write logger (Pino file + Postgres `audit_log`), 6 kategorii eventów, dedykowany UI w `/admin/logs` z filtrami i eksportem, 30-day auto-cleanup.

### Nowe funkcje

- **Rozszerzony event log**: schema `audit_log` (+category, +method, +actor_subiekt_uz_id, +target_type, +target_id) i `product_movements` (+method, +actor_subiekt_uz_id, +correlation_id_idx).
- **Nowy moduł `app-logger.ts`**: dual-write logger (Pino file + Postgres), helper `logEvent({category, action, method, target, details})`, automatyczne maskowanie sensitive keys (PIN, password, token).
- **Nowy endpoint `GET /api/logs`**: filtry (category, method, user, target, date range), full-text search, paginacja, stats per category/method.
- **Nowy endpoint `GET /api/logs/:id`**: szczegóły + related events by correlationId.
- **Nowy endpoint `GET /api/logs/export.csv` i `/export.json`**: eksport przefiltrowanych logów.
- **`/admin/logs` redesign**: search bar, date range picker, multi-select filtry (category, method, user), modal szczegółów, przyciski eksportu.

### Pokrycie logowania

- **auth**: login, logout, login_failed, lockout_activated, session_expired, idle_logout, 401_redirect
- **admin**: user.pin_updated, user.role_updated, config.updated, field_mapping.updated, backup.created/restored/deleted, wizard.import_all/clear, user.warehouse_updated_legacy
- **mobile**: scan.completed, scan.not_found, scan.offline_queued, scan.replay_ok/failed, basket.added/cleared, location.assigned/transferred/reset
- **erp**: erp.query.slow (>500ms), erp.query.error, erp.cache.miss/hit, erp.retry, erp.compensation
- **queue**: queue.added, queue.replayed_ok/failed, idempotency.reused (queue.conflict — patrz sekcja Sprint 8)
- **system**: startup, shutdown, health.fail, memory/disk.warning

### Retencja

- **30 dni** auto-cleanup (uruchamiany co 24h przy starcie serwera + on demand)

### Performance

- Każde skan = 1 INSERT (~2ms)
- ERP queries logowane tylko przy >500ms lub error (nie każde zapytanie)

### Cleanup (T12 chore)

- Usunięte duplikujące się ręczne `db.insert(schema.auditLog)` w `auth.ts` dla `no_user` i `login` (T5 dodał `logEvent` obok istniejącego manual insert → podwójne wpisy). `wrong_pin` zachowany (brak logEvent obok — follow-up Sprint 8).

### Testy (+31, total 187)

- `tests/unit/lib/app-logger.test.ts` — 6 testów (maskSensitive + never throws + Pino masking)
- `tests/unit/lib/cleanup.test.ts` — 4 testy (30d window)
- `tests/integration/logs-endpoints.test.ts` — 3 testy (filtry, export.csv, export.json)
- `tests/unit/routes/activity.test.ts` — pokrycie logEvent dla activity dashboard
- `tests/unit/routes/auth.test.ts` — update 3→2 inserts (po usunięciu duplikatów)
- - pozostałe testy dla T5-T11 (scan, locations, backup, config, server, erp, ui)

## [v1.6.3] — 2026-08-01 (Sprinty 3-6: chicken-and-egg fix, global warehouses, auto-logout 401, warehouse in basket)

Pakiet 4 sprintów zamykających kluczowe problemy produkcyjne v1.6.1.

### Sprint 6: warehouse in basket (regression fix)

**Fix**

- Regresja po Sprint 4: use-basket.ts i mobile.locations.tsx wołały `/api/scan` bez `warehouse` w body → 400 dla operatora → `lookupProduct` zwracał null → koszyk bez nazwy i stanów.
- Naprawione: `lookupProduct(code, warehouseId)` z auth context.
- `offline-queue.ts`: `QueuedScan.warehouse?` + `addScanToQueue(code, location?, warehouse?)` + replay z warehouse w body.

**Testy** (+3, total 146)

- `tests/unit/use-basket.test.tsx` — nowy (3 testy)

### Sprint 5: Auto-logout on session expiry (feat)

**Nowe funkcje**

- **Globalny 401 handler** (`use401Redirect`): subskrybuje QueryCache. Przy HTTP 401 z dowolnego query → clear cache + `auth.logout()` + redirect do odpowiedniego login page.
- **`useAutoLogout` context-aware**: nowy parametr `redirectTo` (admin: `/admin/login`, mobile: `/mobile/login`). Wcześniej hardcoded `/mobile/login`.

**Pliki zmienione**

- `src/lib/use-401-redirect.ts` — nowy (43 linie)
- `src/lib/use-auto-logout.ts` — dodany parametr `redirectTo`
- `src/routes/admin.tsx` — `useAutoLogout(30, "/admin/login")` + `use401Redirect("/admin/login")`
- `src/routes/mobile.tsx` — `use401Redirect("/mobile/login")`
- `src/components/pomagier/MobileShell.tsx` — explicit path
- `src/routes/admin.erp.tsx` — usunięty page-specific 401 redirect (globalny hook wystarczy)

**Testy** (+10, total 156)

- `tests/unit/use-401-redirect.test.tsx` (6 testów: subscribe, 401→redirect, non-401→noop, login page→noop, success update→noop, unmount unsubscribe)
- `tests/unit/use-auto-logout.test.tsx` (4 testy: admin path, mobile path, no user→noop, click resets timer)

### Sprint 4: Global warehouses (refactor)

**Breaking changes**

- **Usunięto per-user warehouse assignment** (`/admin/users` — kolumna "Magazyn" + PUT endpoint). Wszyscy operatorzy mogą korzystać z dowolnego włączonego magazynu.
- **Usunięto kolumnę `users.warehouse_id`** (migracja `0005_drop_user_warehouse.sql`).
- **`POST /api/scan` wymaga `warehouse` w body** dla operatorów (admin może pominąć). Walidacja: warehouse musi być na liście `supported_warehouses`.
- **Login response** nie zwraca `warehouseId` per user.
- **`GET /api/users` response** nie zawiera pola `warehouseId`.

**Nowe funkcje**

- **Nowy endpoint `GET /api/erp/supported-warehouses`** (admin) — zwraca wszystkie magazyny z Subiekta + listę włączonych + flagę `configured`.
- **Nowy endpoint `PUT /api/erp/supported-warehouses`** (admin) — zapisuje listę włączonych magazynów w `config.supported_warehouses` (JSON array).
- **Nowa sekcja w `/admin/erp`**: "Obsługiwane magazyny" — toggle per magazyn z Subiekta + auto-default (isMain gdy pusta).
- **Auto-default isMain**: przy pustej liście `supported_warehouses`, automatycznie włączany jest magazyn z `mag_Glowny=1` (log warning jeśli brak).

**Schemat bazy**

- `DROP INDEX idx_users_warehouse_id`
- `ALTER TABLE users DROP COLUMN warehouse_id`
- `config` table: nowy klucz `supported_warehouses` (JSON array warehouse IDs)

**Bezpieczeństwo**

- Wszystkie endpointy `/api/wizard/*` i `/api/erp/*` są publiczne (Sprint 3 chicken-and-egg fix).
- Magazyn jest wybierany per sesja (frontend `auth.warehouse: {id, symbol}`), nie per user — prostszy model, mniejsza powierzchnia błędu.
- Wszystkie zapytania scan (operator) walidują warehouse w `supported_warehouses` — brak możliwości skanowania dla wyłączonego magazynu.

**Testy** (+11, total 143)

- `tests/unit/routes/erp-supported-warehouses.test.ts` — nowy (6 testów)
- `tests/unit/routes/scan.test.ts` — update (admin może bez warehouse, operator musi + walidacja)
- `tests/unit/routes/users.test.ts` — update (brak warehouseId w response, /api/warehouses filtrowane, PUT 404)

### Sprint 3: Login flow fix (chicken-and-egg)

**Krytyczne (PROD)**

- **Login chicken-and-egg**: `/api/users`, `/api/warehouses` i endpointy wizarda (`/api/wizard/clear`, `/api/wizard/import-all`, `/api/erp-config`, `/api/test-connection`) były zablokowane przez `requireAuthByDefault`. Admin nie mógł zobaczyć listy użytkowników ani ukończyć wizarda. Dodane do `PUBLIC_PATHS` w `auth-middleware.ts` — wizard jest publiczną stroną setupu, wymaga publicznych endpointów.
- **Wizard nie pokazywał PINów**: po `import-all` API zwracało tylko `{seeded: N}`. PINy były tylko w `logger.info` (journalctl). Teraz zwracane w response → widoczne w UI (`results.users.pins`).
- **Domyślny PIN `0000`**: wszystkim użytkownikom setup nadaje PIN `0000` (seed.ts i wizard.ts). Po pierwszym logowaniu admin powinien zmienić PIN przez `PUT /api/users/:subiektId/pin`. Lockout (5 prób / 5 min) nadal aktywny. Patrz SECURITY.md.

**Bezpieczeństwo**

- ⚠️ PIN `0000` to świadoma decyzja dla łatwego onboardingu
- Lockout (5 prób / 5 min) ogranicza ryzyko brute-force
- ⚠️ Publiczne endpointy wizarda akceptują konfigurację z dowolnego hosta w sieci — akceptowalne dla LAN, wymaga setup-tokena dla WAN (Phase 2 hardening)
- Plan: setup token dla wizarda (Phase 2 hardening) — patrz SECURITY.md

**Testy** (+22, total 132)

- `tests/unit/auth-middleware.test.ts` — nowy: PUBLIC_PATHS verification (11 public + 3 protected + 2 path matching + 1 with-user)
- `tests/unit/routes/wizard-skip.test.ts` — nowy: skip param + default PIN 0000 (5 scenariuszy)

### Statystyki v1.6.3

| Metryka                  | Wartość                                                 |
| ------------------------ | ------------------------------------------------------- |
| Pliki routingu API       | 16                                                      |
| Testy (Vitest)           | 156 pass / 6 skip                                       |
| Migracje bazy            | 6 (0000-0005)                                           |
| Decyzje architektoniczne | 16 (w DECISIONS.md)                                     |
| Endpointy publiczne      | 11 (włączając wizard, ERP config, supported-warehouses) |
| Endpointy admin          | ~15                                                     |
| Czas od MVP (v1.0.0)     | 6 dni                                                   |

### Migration guide z v1.6.1

- **DROP `users.warehouse_id`** — kolumna usunięta, dane nieodwracalne (backup przed migracją)
- **`/api/scan` wymaga `warehouse`** — front-end MUSI wysyłać (operator)
- **PIN `0000` dla nowych userów** — zalecana zmiana po pierwszym logowaniu
- **Publiczne endpointy wizarda** — sprawdź firewall jeśli wystawione na WAN

## [v1.6.2] — 2026-07-31 (Tech debt cleanup)

### Porządki techniczne (tech debt)

- **Skrypty test w `package.json`**: dodane `"test": "vitest run"` i `"test:watch": "vitest"`. `npm test` wcześniej failowało z `Missing script: "test"` mimo że dokumentacja deklarowała istnienie testów.
- **Usunięty deprecated `vite-tsconfig-paths`**: plugin w `vitest.config.ts` wyrzucał ostrzeżenie przy każdym uruchomieniu. Zastąpiony natywną opcją Vite `resolve.tsconfigPaths: true`. Zależność `vite-tsconfig-paths` usunięta z `devDependencies`.
- **`react-hooks/exhaustive-deps` w skanerze**: 3 ostrzeżenia lint na krytycznej ścieżce skanowania. Wszystkie trzy referencje są stabilne (state setter, ref, stabilny callback z pustymi deps) — dodanie ich do tablicy deps nie zmienia zachowania, czyni jedynie zależność jawną.

### Testy (+11, total 121)

- 110 istniejących + 11 nowych (brak nowych test files, tylko fixy istniejących)

## [v1.6.1] — 2026-07-31 (Security hardening + auth-by-default)

### Security (CRITICAL)

- **Auth-by-default**: globalny `requireAuthByDefault` middleware — wszystkie endpointy `/api/*` wymagają sesji (whitelist: login, health, company, ca)
- **Fail-closed szyfrowanie configu**: `encryptConfig` rzuca błąd zamiast fallbacku do plaintext
- **CONFIG_ENCRYPTION_KEY**: dedykowany klucz szyfrowania sekretów w config (backward compat z JWT_SECRET)
- **Backup encryption**: `backup.sh` szyfruje tar.gz przez gpg AES-256, wyklucza `.env` i tabelę `sessions`
- **drizzle-orm 0.42→0.45.2**: CVE SQL injection (GHSA-gpj5-g38j-94v9)
- **NULLIF→''**: undo handler zgodny z `NOT NULL` na `tw_Pole1-8`
- **PIN generator**: seed.ts i wizard generują losowe 6-cyfrowe PINy (nie `0000`)
- **Whitelist**: `tw_Opis`/`tw_Uwagi` usunięte z `ALLOWED_LOCATION_FIELDS`

### Ulepszenia

- Correlation ID middleware (`withCorrelation`) podpięty do pipeline
- Frontend `logout()` woła `/api/logout` (invalidacja serwerowej sesji)
- SIGTERM/SIGINT graceful shutdown (zamyka MSSQL pool + HTTP)
- Inventory `whereConditions` typowanie naprawione
- Postgres bind `127.0.0.1` (był `0.0.0.0`)
- Code split: `manualChunks` (vendor-react/radix/utils)
- `manifest.json`: `start_url` relative, `scope`, maskable icons
- SW cache: usunięto `/api/users`, `/api/warehouses` z StaleWhileRevalidate

### Testy (+7, total 121)

- `crypto-config.test.ts`: encrypt/decrypt round-trip, random IV, CONFIG_ENCRYPTION_KEY
- `retry.test.ts`: writeSubiektWithRetry (success, retry, 3-fail-throw)
- `location-card.test.ts`: masking fix (escape hatch `|| 404` usunięte)

### Sprint 2 — domknięcie bezpieczeństwa

- Token sesji usunięty z `localStorage` i odpowiedzi JSON logowania
- Ekrany logowania nie enumerują publicznie operatorów
- Lockout PIN przeniesiony do Postgresa (`login_attempts`)
- Idempotencja przeniesiona do Postgresa (`idempotency_keys`)
- Parametryzowane listy `IN (...)` w inventory/terminals
- Backup restore wymaga dokładnej nazwy pliku
- ErrorBoundary root, poprawne unregister skanera, scoping cen
- Przykładowe pliki deploymentu w `deploy/`

## [1.6.0] — 2026-07-30 Koszyk skanów + Postgres Cache

### Nowe funkcje

- **Koszyk skanów** (`/mobile/scan`): kolejne skany dopisywane do listy zamiast zastępowania. Produkty pokazują symbol, nazwę, lokalizacje. Lokalizacje pokazują kod i liczbę produktów.
- **Tabela `products_cache`** w Postgres: szybki cache podstawowych danych produktów z Subiekta. Pierwsze skanowanie ładuje z MSSQL, każde kolejne z Postgres (~1ms).
- **Endpoint `POST /api/scan-basket`**: Postgres-first lookup (cache + locations), MSSQL fallback. Nie wykonuje ciężkich JOIN-ów ze stanami magazynowymi.
- **Back-buttony** w kartotekach (`/mobile/product/$code`, `/mobile/location/$code`): powrót do koszyka skanów strzałką ←.
- **Kontekst React `ScanBasketContext`**: stan koszyka utrzymywany w layoucie `/mobile`, nie ginie przy nawigacji.

### Pliki zmienione/dodane

| Operacja | Plik                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| Nowy     | `src/lib/scan-basket.tsx` — kontekst koszyka                                           |
| Edycja   | `src/db/schema.ts` — tabela `products_cache`                                           |
| Nowy     | `src/db/migrations/0001_flawless_ma_gnuci.sql`                                         |
| Edycja   | `src/api/routes/scan.ts` — dodany `POST /api/scan-basket`                              |
| Edycja   | `src/routes/mobile.tsx` — ScanBasketProvider                                           |
| Edycja   | `src/routes/mobile.scan.tsx` — przebudowa na koszyk                                    |
| Edycja   | `src/routes/mobile.product.$code.tsx` — back-button                                    |
| Edycja   | `src/routes/mobile.location.$code.tsx` — back-button, usunięty opis słowny lokalizacji |
| Nowy     | `tests/unit/scan-basket.test.tsx` — 5 testów kontekstu                                 |
| Nowy     | `tests/unit/routes/scan-basket.test.ts` — 8 testów endpointu                           |

### Testy

- 100/100 (29 plików), +13 nowych testów
- Build: ✅ | Lint: 0 błędów, 0 ostrzeżeń na zmienionych plikach

## [1.5.0] — 2026-07-29 Refaktoryzacja Frontendu

### Lint

- 0 błędów, 3 ostrzeżenia (react-hooks/exhaustive-deps — akceptowalne)
- Usunięte ~40 `any`, 1 `no-unused-expressions`, 12 ostrzeżeń react-refresh

### Deep Refactor

- `admin.map.tsx`: 662 → 56 linii — rozbity na `useMapData` hook + 7 komponentów (MapGrid, MapControls, MapRack, MapShelf, MapProductCard, MapSidebar, VerifyModal)
- `admin.erp.tsx`: 434 → 121 linii — rozbity na `useErpConfig` hook + 3 komponenty (ErpConnectionForm, ErpTestButton, ErpStatusBadge)
- `ScanHeader.tsx`: wydzielony `useScanInput` hook

### Testy

- React Testing Library + jsdom — 10 nowych testów renderowania
- 85 testów łącznie (26 plików)
- Playwright E2E: 3 scenariusze (scan, map, erp config)

## [1.4.0] — 2026-07-29 Refaktoryzacja API

### API

- Rozbicie `server.ts` (1314 linii) na 14 modułów tras w `src/api/routes/`
- Nowy system obsługi błędów: `ApiError` + `errorHandler` middleware
- Walidacja Zod (`validate`) dla wszystkich endpointów z request body
- Jawne typy TypeScript dla rekordów MSSQL (`src/api/types.ts`) — usunięcie `any` z warstwy API
- `server.ts` zredukowany do ~150 linii

### Testy

- 50 nowych testów jednostkowych (łącznie 65, 18 plików testowych)
- Konfiguracja coverage v8
- Każdy endpoint API: min. 3 testy (happy path, edge case, validation)

### Jakość kodu

- Lint: 0 błędów w warstwie API (40 pozostałych w plikach frontendowych shadcn/admin — poza zakresem)
- 0 `@typescript-eslint/no-explicit-any` w plikach API
- 0 `no-empty` w plikach API
- Build ✅, typecheck ✅, 65/65 testów ✅

## [1.3.0] — 2026-07-29 UX Refinement & Sync Queue

### MobileShell Header Redesign

- New header layout: colored icon square (dashboard-style) + page title (left), queue/warehouse/connection/avatar (right)
- Avatar button with initials → opens centered profile modal (dark mode, warehouse, connection, queue, logout, version)
- Sync tab: colored icon — green (synced), amber (pending), red (offline)
- Page title dynamic from route path (`titleMap`)

### Mobile Login

- PIN entry moved to centered `Dialog` modal (was inline)
- Login page vertically centered with `pt-[40px]`

### BasketPanel — Global Redesign

- Two-column layout: EAN + name (left), quantity controls (right)
- `[-]` button: qty>1 decreases, qty=1 opens `AlertDialog` "Czy usunąć?"
- Color-coded `[+]` green / `[-]` red
- Sound (`beep`) + haptic (`navigator.vibrate`) on +/- buttons
- Product stock info: lazy-fetch in modal on row click (per-warehouse quantities, reserved, available)
- Shared component — used by both `/mobile/inventory` and `/mobile/locations`

### Sync Queue — Full Detail View

- `/mobile/sync` redesign: pending scans list (EAN + timestamp), Sync/Stop/Clear buttons
- Per-item sync results: ✅ OK / ❌ error with message
- `replayQueue()` enhanced: AbortSignal support, per-item `ReplayItem[]` output, `removeSingleScan(id)`

### ScanHeader — Streamlined Tools

- Removed: "Powtórz ostatni skan", "Ostatnie kody", "Kolejka offline", "Wyczyść historię"
- Removed: Camera scanner option (commented out)
- Removed: `pageTitle`/`pageSubtitle` props — title now in MobileShell header
- Sticky header now matches MobileShell height with smooth transition (`transition-all duration-200`)

### Location Post-Save — Result Modal

- Replaced "Weryfikacja" stock comparison card with confirmation modal showing per-product assignment results
- Removed `GET /api/locations/verify` call after save

### ERP Data Migration

- Location code separator changed from `,` to `,` in `tw_Pole1..tw_Pole8` (MSSQL `REPLACE`)
- Dual-read support (`split(/[,;]/)`) for backward compatibility
- All write operations now use `,` separator

### PWA

- Auto-reload on new Service Worker version (`controllerchange` listener in `main.tsx`)

### DevOps

- Fixed MSSQL MCP: pinned `mcp>=1.0,<2.0` for Python 3.14 compatibility

### Tests

- Build: ✅ | Lint: ✅

## [1.2.0] — 2026-07-28 ScanHeader Unification

### Features

- New `ScanHeader` component — unified scan input used on all mobile pages (scan, locations, inventory)
  - `inputmode="none"` prevents Android system keyboard on terminal scanners
  - Flash animation (green/red) for scan feedback
  - Autocomplete suggestions from `/api/products/quick-search` (debounce 300ms)
  - Tools modal (wrench button): repeat last scan, toggle manual/keyboard mode, camera scanner, recent codes, page-specific tools
  - Camera scanner integration via html5-qrcode (fullscreen overlay)
  - Haptic feedback (`navigator.vibrate`) for scan confirmations
  - ScanBus integration for programmatic scan triggers
  - Recent codes persisted per user in localStorage (8h TTL)
  - Focus guard — never steals focus from open modals
  - Unified placeholder: "Zeskanuj kod" on all pages
- New `useRecentCodes()` shared hook for scan history management
- New `haptic()` utility in `lib/utils.ts` for vibration feedback

### Refactors

- `/mobile/scan`: 279→154 lines — removed inline input, flash, beep, recent codes logic
- `/mobile/locations`: 229→273 lines — mode selector moved to tools modal, removed sticky header duplication
- `/mobile/inventory`: 466→204 lines — ScanHeader in scan phase, setup and report phases unchanged
- Removed old `ScanInput.tsx` component (replaced by `ScanHeader`)
- All page `onSubmit` handlers now return `Promise<boolean>` — ScanHeader manages all feedback

### Cleanup

- Lint: 270→130 problems (auto-fixed 122 prettier errors)
- `wizard.tsx`: 3× `useState<any>` → concrete types
- `mobile.locations.tsx`: 3× `catch (e: any)` → `catch (e: unknown)`
- `mobile.inventory.tsx`: 1× `catch (e: any)` → `catch (e: unknown)`

## [1.1.0] — 2026-07-27 Security Hardening & UX

### Security

- CRIT-2: SQL Injection fix — whitelist validation for `locationField` (only `tw_Pole1..tw_Pole8`, `tw_Opis`, `tw_Uwagi`)
- CRIT-4: Token removed from localStorage (`pomagier_auth` → `pomagier_session` without token), only httpOnly cookie
- HIGH: PIN brute-force lockout — 5 failed attempts → 5 minute lockout per `subiektUzId` (in-memory)
- Security audit completed (4 critical, 6 high, 9 medium findings reviewed)

### Refactor: /mobile/locations

- Extracted to components: `ScanInput`, `BasketPanel`, `ConfirmCard`, `HistoryPanel`
- Extracted hooks: `useBasket`, `useScanFocus`, `useLocationMemory`
- Added `beep()` to shared utils
- Page reduced from 547 → ~350 lines, 21 states → 14 states

### UX Improvements

- Loading states on all action buttons (saving, undoing, resetting, transferring)
- Client-side `X-Idempotency-Key` header on all mutation requests
- Scan feedback: beep only (no toast spam), toast only on errors
- Debounce increased 200ms → 300ms for auto-complete
- Removed aggressive global click/touch focus handler

### Test Fixes

- Integration tests: fixed EAN to match `Magnum_Profi` database (product RONDOO SL1)
- Auth tests: migrated from SHA-256 to bcrypt (matching server.ts)
- 15/15 tests passing

### Documentation

- DECISIONS.md: 8 architectural decisions registered
- PRD.md: resolved stale `[Wymaga decyzji]` markers, updated module status
- DEPLOYMENT.md: updated to reflect actual production deployment
- DB_SCHEMA.md: corrected `pin` column documentation (SHA-256 → bcrypt)

---

## [1.0.0] — 2026-07-26 Production Ready

### Security

- bcrypt for PIN hashing (10 rounds, replaced SHA-256)
- httpOnly cookie for JWT
- Idempotency keys (X-Idempotency-Key, 5-min TTL)
- requireAdmin on 14+ write endpoints
- CORS restricted to pomagier.local in production
- Hardcoded secrets removed, env-only
- Helmet + rate-limit (20/min login, 100/min API)

### Features

- Admin login: /admin/login — separate page, role-gated
- Role management: admin/operator toggle in /admin/users
- Self-service PIN change: /mobile/pin for all users
- Product card 2.0: full Subiekt data (VAT, PKWiU, group, weight, movements)
- Location card: /mobile/location/$code — products in location
- Inventory: scope selector (exact/shelf/rack/area), scan, report
- Deployment wizard: 5-step setup with auto-detect
- Backup system: daily cron, local + S3, admin UI, restore
- Location transfer + reset modes
- Movement audit trail (product_movements)
- Duplicates detection + consolidation suggestions
- Visual warehouse grid (aisle×shelf heatmap, 72 cells)
- Dark mode toggle
- WireGuard VPN client + health check

### UX Improvements

- Larger mobile footer icons (h-5 w-5), better spacing
- Admin sidebar: 4 sections (Monitorowanie, ERP, Magazyn, Administracja)
- Sidebar footer: user avatar + status dot + logout
- Header: MSSQL/API badges + dark toggle
- Always-focus scan input, sounds, visual mode

### Performance

- 10 React optimization fixes (side effects, O(n²) lookups, memo)
- server.ts: 2564 → 1023 lines, routes extracted to modules

### Infrastructure

- Caddy HTTPS reverse proxy + static file serving
- mkcert local CA + trusted cert for pomagier.local
- avahi mDNS pomagier.local
- systemd services (pomagier-api, auto-restart)
- Log rotation (pino-roll, daily, 7 days)
- Docker production stage + healthchecks + compose.prod
- Drizzle migrations + auto-migrate on startup

### Tests

- 14 tests (8 unit + 6 integration)

---

## [0.2.0] — 2026-07-25

- PWA: manifest, Service Worker, offline queue
- HTTPS + pomagier.local
- /mobile/locations: assign, transfer, reset
- product_movements audit
- Camera scanner, auto-logout, sync verification
- Production setup script

## [0.1.0] — 2026-07-24

- MVP: React 19 + Vite + Express + Postgres
- ERP adapter, mobile flow, admin panel
- Location system, product list
