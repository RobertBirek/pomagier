# Changelog

## [1.0.0] — 2026-07-26 (Production Ready)

### Security Hardening
- **bcrypt**: PIN hashing replaced SHA-256 (10 salt rounds)
- **httpOnly cookie**: JWT token in secure cookie, not localStorage
- **Idempotency keys**: `X-Idempotency-Key` header for write operations (5-min TTL)
- **requireAdmin**: 14+ previously unprotected endpoints now require admin role
- **CORS**: restricted to pomagier.local in production
- **Hardcoded secrets**: removed from code, env-only
- **Helmet + rate-limit**: security headers, 20/min login, 100/min API

### Refactoring
- **server.ts**: 2564 → 1023 lines (-60%), routes extracted to modules
- **backup routes** → `src/api/routes/backup.ts`
- **location routes** → `src/api/routes/locations.ts`

### New Features
- **Admin login**: `/admin/login` — separate page for admins only
- **Role management**: dropdown Admin/Operator in `/admin/users`
- **Reset mode**: clear all product locations, set only one
- **Product card 2.0**: full Subiekt data (VAT, PKWiU, group, weight, movements)
- **Location card**: `/mobile/location/$code` — all products in location
- **Inventory**: scope selector (exact/shelf/rack/area) + scan + report
- **Deployment wizard**: 5-step setup with auto-detect
- **Backup system**: daily cron, local + S3, admin UI
- **Dark mode**: toggle in headers
- **VPN**: WireGuard client, health check every 5min

### Tests
- 14 tests total (8 unit + 6 integration)

### Infrastructure
- **Caddy**: HTTPS reverse proxy, static file serving
- **mkcert**: local CA + trusted cert for pomagier.local  
- **avahi**: mDNS pomagier.local
- **systemd**: pomagier-api service with auto-restart
- **Log rotation**: pino-roll, daily, 7 days
- **Docker**: production stage + healthchecks + compose.prod
- **Migrations**: Drizzle auto-migrate on startup

---

## [0.2.0] — 2026-07-25
### Added
- PWA: manifest, Service Worker, offline queue
- HTTPS + domena pomagier.local
- /mobile/locations: assign/transfer/reset modes
- product_movements audit trail
- Location picker, duplicates detection, stock verification
- Camera scanner (html5-qrcode)
- Auto-logout, location stats, sync verification

## [0.1.0] — 2026-07-24
### Added
- MVP foundation: React 19 + Vite + TanStack Router + Express + Postgres
- ERP adapter: MssqlErpAdapter + MockErpAdapter
- Mobile flow: login (PIN + JWT), dashboard, scan, product card
- Admin panel: 16 routes, live MSSQL data
- Location system: Code 128 parser, 88 locations
- Product list: 577 items, pagination, search
