# Changelog

## [0.2.0] — 2026-07-25

### Added
- **PWA**: manifest.json, Service Worker (vite-plugin-pwa), offline queue (IndexedDB)
- **HTTPS + domena**: Caddy reverse proxy, mkcert CA, `pomagier.local` (avahi mDNS), systemd services
- **/setup**: pełna instrukcja instalacji CA na Android/iOS/Windows
- **/mobile/locations**: przypisywanie towarów do lokalizacji z pełnym UX
  - Nazwy towarów z Subiekta, dźwięki, tryb wizualny, ostatnia lokalizacja
  - Quantity stepper, auto-complete EAN, historia + undo
  - Szybki wybór lokalizacji (LocationPicker)
  - Weryfikacja stanu (Postgres vs Subiekt)
  - Tryb przenoszenia między lokalizacjami
- **Audyt ruchów**: `product_movements` table, logowanie każdego assign/transfer/undo
- **Duplikaty + sugestie**: wykrywanie towarów w odległych lokalizacjach, propozycje konsolidacji
- **Weryfikacja spójności**: `/api/locations/verify-sync` — porównanie Postgres ↔ Subiekt
- **Dark mode**: ☀️/🌙 toggle, localStorage, prefers-color-scheme
- **Camera scanner**: html5-qrcode z dynamicznym importem, inline + fullscreen
- **HTTPS cert**: `/api/ca?format=crt` dla Windows

### Changed
- **SSR → SPA**: TanStack Start usunięty, czysty React + Vite + TanStack Router
- **Express API**: wydzielony serwer (port 3000), Vite proxy `/api`
- **Lokalizacje w Postgres**: source of truth, import z Subiekta jednorazowy
- **Field mapping**: konfigurowalne mapowanie pól Pomagier ↔ Subiekt (`fieldmap_location`)
- **Status MSSQL**: live wskaźnik online (useMssqlStatus hook)
- **Mobile shell**: "Lokaliz." tab zamiast "Zadania"
- **Admin panel**: live dane z MSSQL (users, warehouses, ERP config, stats)
- **Safe area**: CSS `env(safe-area-inset-*)` dla PWA notch

### Fixed
- Pino-pretty crash w SSR
- Named instance MSSQL (`host\instance`)
- Product list deduplication (subquery SUM)
- Login infinite re-render (setState in select)
- Vite allowedHosts dla pomagier.local
- Caddy cert permissions

---

## [0.1.0] — 2026-07-24

### Added
- **MVP foundation**: React 19 + Vite 8 + TanStack Router + Tailwind CSS 4 + shadcn/ui
- **Docker stack**: postgres:16, Dockerfile multi-stage
- **ERP adapter**: MssqlErpAdapter (parametryzowane zapytania), MockErpAdapter
- **Mobile flow**: login (PIN + JWT), dashboard, scan page, product card
- **Admin panel**: 16 routes, live KPI, ERP config form
- **Postgres schema**: users (subiekt_uz_id + PIN), sessions, audit_log, config, locations, product_locations
- **Express API**: health, scan, company, users, warehouses, login, stats, products (paginated)
- **Field mapping**: konfigurowalne `tw_PoleX` per feature
- **Location system**: Code 128 parser (`A 1-2-3-4`), 88 locations imported
- **Product list**: 577 towarów, paginacja, search, filtrowanie
- **Seed script**: PIN-y dla operatorów Subiekta
- **Testy**: Vitest (8/8), ERP adapter + auth unit tests
- **Documentation**: AGENTS.md, README, PRD, ARCHITECTURE, PLAN, TASKS, SECURITY
