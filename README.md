# PomagierGT

Aplikacja webowa i mobilna PWA stanowiąca warstwę operacyjną pomiędzy użytkownikami magazynu a systemem ERP **Insert Subiekt GT**.

## Architektura

System składa się z dwóch części:

1. **Panel administracyjny** — przeznaczony głównie na desktop. Zarządzanie użytkownikami, terminalami, uprawnieniami, konfiguracją, monitoring operacji i synchronizacji.

2. **Klient magazynowy (PWA)** — działający na terminalach Android z fizycznym czytnikiem kodów kreskowych, telefonach Android (kamera) oraz innych urządzeniach z przeglądarką.

## Docelowe moduły

- Informacja o towarze (skanowanie kodu → dane produktu i lokalizacja)
- Lokalizacja towaru w magazynie
- Inwentaryzacja
- Kompletacja
- Przyjęcie i weryfikacja dostaw
- Przesunięcia magazynowe
- Obsługa zadań magazynowych
- Synchronizacja operacji z Subiektem GT
- Logi, kolejki, statusy i diagnostyka
- Zarządzanie użytkownikami, terminalami i uprawnieniami

## Repozytorium

**Produkcyjne**: https://github.com/RobertBirek/pomagier.git

## Stan projektu

- [x] Konfiguracja opencode (agenci, skille, pliki wiedzy)
- [x] Faza 0: Audyt repozytorium i środowiska — zakończona 2026-07-29
- [x] MVP v1.0.0 — informacja o towarze, lokalizacje, użytkownicy, panel admina, PWA, backup
- [x] v1.3.0 — UX, Sync Queue, BasketPanel, szkielet inwentaryzacji i kompletacji
- [x] v1.4.0 — Refaktoryzacja API: modularne trasy, Zod walidacja, 65 testów, lint czysty
- [x] v1.6.1 — Security hardening, auth-by-default, backup encryption, logout, retry/compensation, 112 testów
- [x] v1.6.2 — Tech debt cleanup (test scripts, vite-tsconfig-paths, exhaustive-deps), 121 testów
- [x] v1.6.3 — Sprinty 3-6: chicken-and-egg fix, global warehouses, auto-logout on 401, warehouse in basket fix, **156 testów**
- [x] v1.7.0 — Comprehensive Logging: 6 kategorii eventów, full-text search, date range, export CSV/JSON, auto-cleanup 30 dni, **187 testów**
- [x] v1.8.0 — Queue + System eventy (queue.added/replayed, idempotency.reused, startup/shutdown, memory/disk), /api/logs/users, 214 testów
- [x] v1.9.0 — queue.conflict (409 detection) + actor traceability w queue events, 220 testów
- [x] v1.9.1 — actor w idempotency.reused + cleanup backlog (dead code, idiomatic catch), 222 testów
- [x] v1.10.0 — location sync hardening (B1-B4 bug fixes, E3-E8 cleanup) + timestamp-based Subiekt change detection + SyncStatusBadge UI, 296 testów
- Aktualny stack: React 19 + Express 5 + Postgres 16/Drizzle + MSSQL Subiekt GT + Caddy + Playwright
