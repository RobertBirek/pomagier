# CHANGELOG — PomagierGT

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
