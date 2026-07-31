# CHANGELOG — PomagierGT

## [Unreleased] — Audyt + Security hardening

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

### Testy (+7, total 112)
- `crypto-config.test.ts`: encrypt/decrypt round-trip, random IV, CONFIG_ENCRYPTION_KEY
- `retry.test.ts`: writeSubiektWithRetry (success, retry, 3-fail-throw)
- `location-card.test.ts`: masking fix (escape hatch `|| 404` usunięty)

## [1.6.0] — 2026-07-30 Koszyk skanów + Postgres Cache

### Nowe funkcje
- **Koszyk skanów** (`/mobile/scan`): kolejne skany dopisywane do listy zamiast zastępowania. Produkty pokazują symbol, nazwę, lokalizacje. Lokalizacje pokazują kod i liczbę produktów.
- **Tabela `products_cache`** w Postgres: szybki cache podstawowych danych produktów z Subiekta. Pierwsze skanowanie ładuje z MSSQL, każde kolejne z Postgres (~1ms).
- **Endpoint `POST /api/scan-basket`**: Postgres-first lookup (cache + locations), MSSQL fallback. Nie wykonuje ciężkich JOIN-ów ze stanami magazynowymi.
- **Back-buttony** w kartotekach (`/mobile/product/$code`, `/mobile/location/$code`): powrót do koszyka skanów strzałką ←.
- **Kontekst React `ScanBasketContext`**: stan koszyka utrzymywany w layoucie `/mobile`, nie ginie przy nawigacji.

### Pliki zmienione/dodane
| Operacja | Plik |
|---|---|
| Nowy | `src/lib/scan-basket.tsx` — kontekst koszyka |
| Edycja | `src/db/schema.ts` — tabela `products_cache` |
| Nowy | `src/db/migrations/0001_flawless_ma_gnuci.sql` |
| Edycja | `src/api/routes/scan.ts` — dodany `POST /api/scan-basket` |
| Edycja | `src/routes/mobile.tsx` — ScanBasketProvider |
| Edycja | `src/routes/mobile.scan.tsx` — przebudowa na koszyk |
| Edycja | `src/routes/mobile.product.$code.tsx` — back-button |
| Edycja | `src/routes/mobile.location.$code.tsx` — back-button, usunięty opis słowny lokalizacji |
| Nowy | `tests/unit/scan-basket.test.tsx` — 5 testów kontekstu |
| Nowy | `tests/unit/routes/scan-basket.test.ts` — 8 testów endpointu |

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
