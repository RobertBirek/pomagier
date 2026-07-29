# TASKS — PomagierGT v1.3.0

| Data | Zadanie | Status |
|---|---|---|
| 2026-07-29 | MobileShell: header redesign — colored icon square + avatar + queue/warehouse/connection badges | ✅ |
| 2026-07-29 | MobileShell: avatar profile modal (centered, dark mode, warehouse, queue, logout, version) | ✅ |
| 2026-07-29 | MobileShell: Sync tab icon color (green/amber/red) based on connection + queue status | ✅ |
| 2026-07-29 | MobileShell: dynamic page title from route path (titleMap) | ✅ |
| 2026-07-29 | Mobile login: PIN in Dialog modal + vertical centering + 40px top padding | ✅ |
| 2026-07-29 | BasketPanel: global redesign — 2-column layout, AlertDialog for qty=1, color +/- buttons | ✅ |
| 2026-07-29 | BasketPanel: beep + haptic on +/- buttons | ✅ |
| 2026-07-29 | BasketPanel: lazy-fetch stock info in modal on row click (per-warehouse quantities) | ✅ |
| 2026-07-29 | BasketPanel: shared component used by /mobile/inventory + /mobile/locations | ✅ |
| 2026-07-29 | Sync page: full redesign — pending scans list, Sync/Stop/Clear, per-item results | ✅ |
| 2026-07-29 | Offline queue: replayQueue with AbortSignal, removeSingleScan, per-item ReplayItem[] | ✅ |
| 2026-07-29 | ScanHeader: removed pageTitle/pageSubtitle — title now in MobileShell header | ✅ |
| 2026-07-29 | ScanHeader: removed "Powtórz ostatni", "Ostatnie kody", "Kolejka offline", "Wyczyść historię" | ✅ |
| 2026-07-29 | ScanHeader: hidden camera scanner option | ✅ |
| 2026-07-29 | ScanHeader: sticky height matches MobileShell with smooth transition (IntersectionObserver) | ✅ |
| 2026-07-29 | Locations: removed "Przypisz do ostatniej lokalizacji" button | ✅ |
| 2026-07-29 | Locations: post-save result modal (product list confirmation, replaced stock verification card) | ✅ |
| 2026-07-29 | ERP: location separator migration `,` → `,` in tw_Pole1..tw_Pole8 (MSSQL REPLACE) | ✅ |
| 2026-07-29 | ERP: dual-read split(/[,;]/) + write join(",") for backward compatibility | ✅ |
| 2026-07-29 | PWA: auto-reload on new Service Worker (controllerchange listener) | ✅ |
| 2026-07-29 | DevOps: MSSQL MCP pinned mcp>=1.0,<2.0 for Python 3.14 compatibility | ✅ |
| 2026-07-29 | Build: ✅ | Lint: ✅ clean (API-layer), 40 pre-existing warnings only in frontend shadcn/admin | ✅ |

---

# TASKS — PomagierGT v1.4.0

| Data | Zadanie | Status |
|---|---|---|
| 2026-07-29 | Refaktoryzacja API: podział server.ts na 14 modułów tras w src/api/routes/ | ✅ |
| 2026-07-29 | Nowy system błędów: ApiError + errorHandler middleware | ✅ |
| 2026-07-29 | Walidacja Zod (validate middleware) dla wszystkich endpointów z body | ✅ |
| 2026-07-29 | Jawne typy MSSQL (types.ts) — usunięcie `any` z warstwy API | ✅ |
| 2026-07-29 | server.ts zredukowany z 1314 → ~150 linii | ✅ |
| 2026-07-29 | Testy: 65 testów (15 istniejących + 50 nowych), 18 plików | ✅ |
| 2026-07-29 | Coverage v8 skonfigurowany | ✅ |
| 2026-07-29 | Lint: 40 błędów (tylko frontend, poza zakresem), 0 błędów w API | ✅ |
| 2026-07-29 | Dokumentacja: README, CHANGELOG, TASKS zaktualizowane | ✅ |

---

# TASKS — PomagierGT v1.2.0 (archived)

| Data | Zadanie | Status |
|---|---|---|
| 2026-07-28 | ScanHeader: unified scan input component (sticky, flash, autocomplete, tools, camera) | ✅ |
| 2026-07-28 | ScanHeader: inputmode="none" — no Android keyboard on scanner terminals | ✅ |
| 2026-07-28 | ScanHeader: tools modal — repeat last, manual toggle, camera scanner, recent codes | ✅ |
| 2026-07-28 | ScanHeader: haptic feedback + scanBus integration | ✅ |
| 2026-07-28 | Refactor /mobile/scan → ScanHeader | ✅ |
| 2026-07-28 | Refactor /mobile/locations → ScanHeader | ✅ |
| 2026-07-28 | Refactor /mobile/inventory → ScanHeader | ✅ |
| 2026-07-28 | Remove old ScanInput.tsx | ✅ |
| 2026-07-28 | New: useRecentCodes.ts hook + haptic() utility | ✅ |
