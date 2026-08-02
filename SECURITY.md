# Security — PomagierGT

## Zasady ogólne

### Sekrety

Nigdy w repozytorium nie mogą znaleźć się:

- Hasła MSSQL
- Tokeny i klucze API
- Dane dostępowe Sfery GT
- Connection stringi zawierające hasła
- Certyfikaty prywatne

Placeholdery w `.env.example`:

- `{{MSSQL_HOST}}`
- `{{MSSQL_DATABASE}}`
- `{{MSSQL_USER}}`
- `{{MSSQL_PASSWORD}}`
- `{{DATABASE_URL}}`
- `{{JWT_SECRET}}`
- `{{CONFIG_ENCRYPTION_KEY}}`
- `{{BACKUP_ENCRYPTION_KEY}}`

### RBAC i autoryzacja

- Role: `admin` (pełny dostęp panel + API mutacji) i `operator` (terminal mobilny)
- Globalny middleware `requireAuthByDefault` — wszystkie endpointy `/api/*` wymagają sesji (whitelist: `/api/login`, `/api/health`, `/api/company`, `/ca`)
- `requireAdmin` na endpointach administracyjnych (ERP config, field mappings, backup, activity, logs, terminals, wizard, sync)
- Timeout sesji konfigurowalny przez `SESSION_TIMEOUT_MINUTES` (domyślnie 15 min)
- Przypisanie użytkownika do magazynu — [Wymaga decyzji]

### Ochrona danych

- Logi bez danych wrażliwych (pino serializers, redact)
- Maskowanie sekretów w panelu administracyjnym (`••••••••`)
- Audyt działań administracyjnych (audit_log)
- AES-256-GCM szyfrowanie `mssql_password` w tabeli config (klucz z `CONFIG_ENCRYPTION_KEY` lub `JWT_SECRET`)

### Setup wizard (Sprint 3 — chicken-and-egg fix)

**Kontekst**: Wizard (`/wizard`) jest publiczną stroną setupu, ale jego endpointy backendowe wymagały `requireAdmin`. To tworzyło chicken-and-egg: admin musiałby istnieć zanim ktokolwiek mógłby go utworzyć.

**Decyzja**: Endpointy wizarda (`/api/wizard/clear`, `/api/wizard/import-all`, `/api/erp-config`, `/api/test-connection`) oraz endpointy list (`/api/users`, `/api/warehouses`) dodane do `PUBLIC_PATHS` w `auth-middleware.ts`. `requireAdmin` zdjęty z `/api/wizard/clear` i `/api/wizard/import-all`.

**Domyślny PIN `0000`**: Wszystkim użytkownikom setup nadaje PIN `0000` (seed.ts i wizard.ts). Świadoma decyzja dla szybkiego onboardingu w środowisku LAN. Po pierwszym logowaniu admin powinien zmienić PIN przez `PUT /api/users/:subiektId/pin`.

**Kompromis**:

- ✅ Szybki onboarding, brak chicken-and-egg
- ✅ Lockout 5 prób / 5 min ogranicza brute-force
- ⚠️ Publiczne endpointy wizarda akceptują konfigurację z dowolnego hosta w sieci
- ⚠️ PIN `0000` dla 13 userów × 5 prób / 5 min = max 65 prób / 5 min na złamanie konta

**Phase 2 hardening (planowane)**:

- **Setup token**: wizard wymaga podania tokenu z ENV (`SETUP_TOKEN`) — generowany przy pierwszym uruchomieniu, wyświetlany w journalctl
- **IP whitelist**: setup endpointy akceptują tylko requesty z localhost lub zdefiniowanych IP
- **Setup lockout**: po 3 nieudanych próbach setup tokenu — cooldown 30 min
- **Mandatory PIN rotation**: flaga `must_rotate_pin` w tabeli `users`, wymuszająca zmianę PINu przed dostępem do operacji

### OWASP

- SQL injection: parametryzacja wszystkich zapytań MSSQL, whitelist `ALLOWED_LOCATION_FIELDS`
- XSS: CSP headers, `dangerouslySetInnerHTML` tylko w chart.tsx (developer-controlled)
- CSRF: JWT w httpOnly cookie z `SameSite=strict`
- Rate limiting: login 20/min, API 100/min, health 300/min
- Bezpieczne cookies: HttpOnly, Secure (prod), SameSite=strict
- TLS: Caddy (HTTPS) + MSSQL `encrypt: true`
- Idempotencja: `X-Idempotency-Key` header dla assign/undo/transfer
- Correlation ID: `withCorrelation` middleware propaguje ID do wszystkich logów

### Magazyny (Sprint 4 — global warehouses)

- **Brak per-user warehouse assignment**: usunięty `users.warehouse_id` + endpoint `PUT /api/users/:id/warehouse`. Prostszy model, mniejsza powierzchnia błędu.
- **Globalna lista `config.supported_warehouses`**: admin w `/admin/erp` decyduje które magazyny są dostępne dla wszystkich operatorów.
- **Auto-default isMain**: przy pustej liście automatycznie włączany jest magazyn z `mag_Glowny=1`. Zapobiega przypadkowemu zablokowaniu pracy.
- **Walidacja w scan**: operator bez warehouse w body → 400; warehouse spoza listy supported → 400. Admin może pominąć warehouse (scan bez filtra).
- **Magazyn per sesja**: frontend `auth.warehouse: {id, symbol}` — wybierany przy logowaniu, przechowywany w localStorage, wysyłany w body każdego skanu.
- **Brak sekretów w liście**: lista warehouse IDs to tylko numery z `sl_Magazyn.mag_Id` — brak wrażliwych danych.

### Ochrona danych ERP

- Zapis do `tw__Towar` tylko przez whitelist `tw_Pole1-8` (pola dowolnego przeznaczenia)
- `tw_Opis`/`tw_Uwagi` usunięte z whitelist — ochrona biznes-opisów towarów
- Odczyty MSSQL: parametryzowane, timeout 10s, `trustServerCertificate: true` (LAN)
- Retry MSSQL writes: 3 próby z exponential backoff (100/200/400ms)
- Kompensacja dual-write: rollback Postgres przy błędzie MSSQL (assign)
- Przeglądarka NIGDY nie łączy się bezpośrednio z MSSQL

## Stan wdrożenia

- [x] Walidacja zmiennych środowiskowych przy starcie (Zod, env.ts)
- [x] RBAC (requireAuthByDefault + requireAdmin/requireAuth)
- [x] Rate limiting (login 20/min, API 100/min, health 300/min)
- [x] TLS między komponentami (Caddy HTTPS + MSSQL encrypt)
- [x] Idempotencja operacji zapisujących (X-Idempotency-Key, assign/undo/transfer)
- [x] Correlation ID w logach (withCorrelation middleware)
- [x] Maskowanie sekretów w UI admina (••••••••)
- [x] Szyfrowanie sekretów w bazie (AES-256-GCM, crypto-config.ts)
- [x] Backup encryption (gpg AES-256, wykluczenie .env i sessions)
- [x] SIGTERM graceful shutdown (pool.close + server.close)
- [x] Global warehouses (Sprint 4): brak per-user assignment, lista supported, auto-default isMain
- [x] Auto-logout on 401 (Sprint 5): globalny QueryCache subscription, context-aware useAutoLogout
- [x] Comprehensive Logging (Sprint 7): 6 kategorii eventów, maskSensitive, /api/logs + UI, 30-day cleanup
- [x] Comprehensive Logging extension (Sprint 8): queue + system coverage, /api/logs/users, correlation search, CSV injection fix

### Auto-logout on session expiry (Sprint 5)

**Kontekst**: Po wdrożeniu Sprint 4 okazało się, że:

1. `useAutoLogout` miał hardcoded `/mobile/login` — admin po idle timeout lądował na mobile login
2. Tylko `admin.erp.tsx` miał lokalną logikę 401 (page-specific)
3. Brak globalnej obsługi 401 z serwera — token wygasł, UI psuło się bez informacji

**Decyzja**: `use401Redirect(redirectTo)` — globalny hook subskrybujący QueryCache. Przy HTTP 401 z dowolnego query: `qc.clear()` + `auth.logout()` + `nav({to: redirectTo})`. Osobna instancja dla `/admin` (→ `/admin/login`) i `/mobile` (→ `/mobile/login`).

**Zapobieganie pętli**: Hook nie przekierowuje jeśli aktualna ścieżka === redirectTo (zapobiega pętli przy złych credentials na stronie logowania).

**useAutoLogout context-aware**: Nowy parametr `redirectTo` (admin: `/admin/login`, mobile: `/mobile/login`). Backward compat: domyślnie `/mobile/login`.

### Warehouse in scan walidacja (Sprint 6)

**Kontekst**: Po Sprint 4, `/api/scan` zwracał 400 dla operatorów bez `warehouse` w body. Regresja w `use-basket.ts` i `mobile.locations.tsx` — wołały endpoint bez warehouse → `lookupProduct` zwracał null → koszyk bez nazwy i stanów.

**Fix**:

- `use-basket.ts`: `lookupProduct(code, warehouseId)` z auth context
- `mobile.locations.tsx`: `lookupProduct(code, auth.warehouse?.id)`
- `offline-queue.ts`: `QueuedScan.warehouse?` + `addScanToQueue(code, location?, warehouse?)` + replay z warehouse w body
- `mobile.scan.tsx`: `addScanToQueue(code, undefined, warehouse?.id)`

**Konsekwencja**: każde skanowanie (online i offline queue replay) musi mieć warehouse w body. Walidacja na serwerze sprawdza czy warehouse jest w `supported_warehouses`.

### Comprehensive Logging (Sprint 7)

**Kontekst**: Po wdrożeniu Sprint 6 okazało się, że brakuje pełnego audytu kto + co + jaką metodą zmienił w systemie. Utrudnia audyty i diagnostykę.

**Decyzja**: dual-write logger (Pino file + Postgres `audit_log`) z helper `logEvent()`. Schema `audit_log` rozszerzone o `category`, `method`, `actor_subiekt_uz_id`, `target_type`, `target_id`. Nowy endpoint `GET /api/logs` z filtrami. 30-day auto-cleanup.

**Sensitive data**: helper `maskSensitive()` automatycznie maskuje `pin`, `password`, `token`, `cookie`, `authorization` w `details` (recursive, case-insensitive). PINy nigdy nie trafiają do DB w plaintext.

**Coverage**: 6 kategorii (auth, admin, mobile, erp, queue, system). Pełen opis w `docs/superpowers/specs/2026-08-01-comprehensive-logging-design.md`.

### Comprehensive Logging extension (Sprint 8)

- **queue + system coverage**: 3 queue events (queue.added, queue.replayed_ok/failed, idempotency.reused) + 5 system events (startup, shutdown, health.fail, memory.warning, disk.warning). Teraz 6/6 kategorii aktywnych. `queue.conflict` dodany w Sprint 9 (patrz niżej).
- **/api/logs/users**: nowy endpoint do dynamicznego dropdownu użytkowników (zastąpił hardcoded listę).
- **Correlation search**: `?correlation=xxx` URL param w /admin/logs auto-filluje filtr z modala.
- **Defensive**: CSV injection fix (tab prefix), transactional cleanup, clearInterval on shutdown.

### queue.conflict + Actor traceability for queue events (Sprint 9 + v1.9.1)

**Kontekst**: Po Sprint 8 brakowało (1) `queue.conflict` (rozróżnienie permanent 409 od transient failures) i (2) `actor_subiekt_uz_id` w queue events (brak wiedzy KTO zainicjował offline queue).

**Decyzja (Sprint 9)**:

- `queue.conflict` — emit przy HTTP 409 z serwera podczas replay (np. lokalizacja już istnieje). Osobny action niż `queue.replayed_failed` (transient).
- `addScanToQueue` i `replayQueue` przyjmują `actorSubiektUzId` (4./2. parametr). Frontend callerzy (`mobile.scan.tsx`, `mobile.locations.tsx`, `mobile.sync.tsx`) przekazują `auth.user?.subiektUzId`. Wszystkie logEvent calls w queue events mają teraz actor.

**Rozszerzenie (v1.9.1, Sprint 10)**:

- `checkIdempotency(key, actorSubiektUzId?)` — callerzy w `locations.ts` (3 handlery: assign, transfer, reset) przekazują `req.user?.subiektUzId`. Kto użył tego samego X-Idempotency-Key jest teraz widoczne w /admin/logs.

**Pozostałe**: brak — pełen coverage actor dla queue + idempotency.

### Location code sync hardening (Sprint 11)

**Kontekst**: 4 real bugs (B1-B4) zagrażały integralności danych lokalizacji między Postgres a Subiekt. Brak timestamp-based change detection powodował, że ręczne zmiany w Subiekcie były niewidoczne.

**Decyzja**:

- **B1 Subiekt varchar(50) overflow guard** (`safeSubiektValue`) — 4+ kodów długości 12-13 znaków overflow Subiekt. Teraz rzuca error 400 zamiast silent truncate.
- **B2 transfer/reset dual-write compensation** — mirrors assign pattern. Decyzja #9 (DECISIONS.md) teraz fully implemented.
- **B3 fix-sync-batch subiekt-to-postgres diff merge** — diff-based zamiast destructive delete+insert. Dane nie giną przy malformed Subiekt value.
- **B4 reset uses writeSubiektWithRetry** — consistent retry behavior.
- **C3+E8 centralize isMalformedCode** — single regex from `lib/locations.ts`.
- **E7 CHECK quantity > 0** — migration 0007.
- **Timestamp-based change detection** (`tw_CzasM`): `subiekt-sync-monitor` cron co 5 min + `GET /api/locations/subiekt-changes` + `SyncStatusBadge` UI w /admin/verify.

**Testy**: +74 (296 total) — pełen coverage dla location code logic.
