# Changelog

## [0.2.0] — 2026-07-25

### Added
- **Wizard wdrożeniowy**: 5 kroków (MSSQL→Mapowanie→Czyszczenie→Import→Start), auto-detect przy pierwszym uruchomieniu
- **Auto-logout**: 15min mobile, 30min admin bezczynności
- **Login audit**: każde logowanie/nieudana próba w `audit_log`
- **Mapa magazynu 2.0**: wizualna siatka alejka×półka (72 komórki), heatmapa, wyszukiwarka, puste lokalizacje
- **Szczegóły lokalizacji**: modal z produktami, historią, stock verification
- **Eksport etykiet PDF**: jspdf, kody Code 128 do druku
- **Weryfikacja spójności**: modal z rozbieżnościami, checkboxy per produkt, bidirectional sync + clear
- **Dashboard aktywności**: wykres dzienny 7 dni, ostatnie ruchy
- **Firefox CA**: instrukcja instalacji certyfikatu
- **/admin/logs**: realne dane z `product_movements` + `audit_log`
- **Logowanie do /admin**: przycisk wylogowania w nagłówku
- **Domyślny PIN**: 0000 dla nowych operatorów (seed)

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
