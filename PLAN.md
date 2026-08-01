# Plan — PomagierGT

## Stan: v1.6.3 Production (2026-08-01)

MVP (v1.0.0) osiągnięty 2026-07-26. Wersja v1.6.3 (2026-08-01) zamyka Sprinty 3-6: chicken-and-egg fix, global warehouses, auto-logout on 401, warehouse-in-basket fix. 156 testów pass / 6 skip. Projekt gotowy na rozwój kolejnych modułów magazynowych (inwentaryzacja, kompletacja, przyjęcie dostaw).

## 1. Podsumowanie projektu

PomagierGT — aplikacja PWA dla magazynu, stanowiąca warstwę operacyjną między operatorami terminali a systemem ERP Insert Subiekt GT.

## 2. Cel obecnej fazy

Rozwój kolejnych modułów magazynowych: inwentaryzacja, kompletacja, przyjęcie dostaw — przy zachowaniu stabilności produkcyjnej.

## 3. Ustalone fakty

- VPS: Ubuntu 26.04, 6.2 GB RAM, 57 GB SSD, Docker v29.6.2, Node.js v22
- MSSQL Subiekt GT: dostępny przez sieć lokalną, bezpośrednie połączenie TDS
- Backend: Express 5 (port 3000), zarządzany przez systemd (pomagier-api)
- Frontend: React 19 SPA, serwowany statycznie przez Caddy z `/pomagier/dist/`
- Reverse proxy: Caddy (HTTPS, port 443, HTTP/3)
- mDNS: avahi-daemon (pomagier.local)
- Baza aplikacyjna: Postgres 16 z Drizzle ORM
- Repo produkcyjne: `/pomagier`, branch `main`
- Publiczny URL: `https://pomagier.ilovelighting.hmcloud.pl`

## 4. Założenia

- `[Założenie robocze: MSSQL dostępny z VPS — health check potwierdzony, ~250ms latency]`
- `[Założenie robocze: Operatory logują się PIN-em (bcrypt) na terminalach Android]`
- `[Założenie robocze: Lokalizacje przechowywane w Postgres + synchronizowane do tw_Pole1 Subiekta]`

## 5. Ograniczenia

- `[Ograniczenie: Brak Sfery GT — tylko bezpośredni MSSQL (odczyt i whitelist zapis)]`
- `[Ograniczenie: `trustServerCertificate: true` dla MSSQL — akceptowalne tylko w LAN]`
- `[Ograniczenie: Service Worker cache obejmuje tylko wybrane endpointy API]`

## 6. Moduły zrealizowane

- [x] Informacja o towarze po skanie EAN
- [x] Lokalizacja towaru (przypisywanie, przenoszenie, reset, weryfikacja, mapa)
- [x] Zarządzanie użytkownikami (import z Subiekta, PIN, role admin/operator)
- [x] Panel administracyjny (dashboard, produkty, użytkownicy, magazyny, terminale, ERP config, backup)
- [x] Logi i audyt (audit_log, product_movements)
- [x] PWA (Service Worker, offline queue IndexedDB, instalowalna na Android)
- [x] Backup (lokalny + S3, planowanie, przywracanie)
- [x] Deployment wizard (5 kroków, auto-detekcja)
- [x] Własny CA (mkcert, certyfikat dla pomagier.local)
- [x] WireGuard VPN client + health check

## 7. Moduły w trakcie rozwoju

- [ ] Inwentaryzacja — szkielet UI istnieje (`/mobile/inventory`), brak pełnego flow
- [ ] Kompletacja — szkielet UI istnieje (`/mobile/picking`, `picking-flow.tsx`)
- [ ] Przyjęcie dostaw — szkielet UI istnieje (`/mobile/receiving`)
- [ ] Obsługa zadań magazynowych — szkielet (`/mobile/my-tasks`)
- [ ] Synchronizacja operacji z Subiektem GT — częściowa (lokalizacje do tw_Pole1)

## 8. Architektura logiczna (aktualna)

```
┌─────────────────────────────────────────────┐
│               Przeglądarka / PWA             │
│  React 19, TypeScript, TanStack Router       │
│  Tailwind CSS 4, shadcn/ui                   │
│  Service Worker (Workbox, offline cache)     │
└──────────────────┬──────────────────────────┘
                   │ HTTPS (Caddy) + JWT httpOnly cookie
┌──────────────────▼──────────────────────────┐
│              Express 5 API (VPS Linux)       │
│  - Walidacja (Zod), RBAC, rate limiting      │
│  - Kolejka offline, idempotencja             │
│  - Structured logging (Pino)                 │
│  - Embedded MSSQL adapter                    │
└──────┬───────────────────────┬──────────────┘
       │                       │
┌──────▼──────┐     ┌──────────▼──────────────┐
│  Postgres 16│     │   Insert Subiekt GT       │
│  (Drizzle)  │     │   MSSQL (TDS)             │
│  - users    │     │   - tw__Towar, tw_Stan    │
│  - sessions │     │   - sl_Magazyn            │
│  - locations│     │   - pd_Uzytkownik         │
│  - audit    │     │   - vwFeniksFirmaSync     │
│  - config   │     │   - uf_SynchroKodyKresk   │
└─────────────┘     └──────────────────────────┘
```

## 9. Topologia wdrożenia

- **API**: systemd `pomagier-api` — `tsx src/api/server.ts`, auto-restart, port 3000
- **Frontend**: statyczne pliki z `dist/`, serwowane przez Caddy
- **Caddy**: HTTPS reverse proxy (port 443), HTTP/3, własny certyfikat mkcert
- **Postgres**: lokalnie na VPS, port 5432
- **MSSQL Subiekt**: zewnętrzny serwer Windows w sieci lokalnej, port 1433
- **Docker Compose**: dostępny dla developmentu, nieużywany w produkcji

## 10. Granice odpowiedzialności

| Komponent     | Odpowiada za                                                                  | NIE odpowiada za                |
| ------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| PWA / SPA     | UI, skanowanie (ScanHeader), kolejka offline, Service Worker                  | Bezpośrednie zapytania do MSSQL |
| Express API   | Auth (JWT, bcrypt), RBAC (admin/operator), walidacja, logi, trasy             | Logika biznesowa ERP            |
| MSSQL Adapter | Bezpieczny odczyt i whitelist-zapis do Subiekta GT, parametryzowane zapytania | Autoryzacja, rate limiting      |
| Postgres      | Users, sessions, locations, audit_log, config, product_movements              | Dane ERP (towary, dokumenty)    |

## 11. Model komunikacji z ERP

- Przeglądarka → Caddy: HTTPS/2, HTTP/3
- Caddy → Express API: HTTP reverse proxy (localhost:3000)
- Express → MSSQL: TDS, parametryzowane zapytania, timeout 10s
- Konto MSSQL: read-write z whitelist walidacją pól (np. `tw_Pole1` dla lokalizacji)
- Idempotencja: `X-Idempotency-Key` nagłówek, 5-minutowy TTL w pamięci

## 12. Strategia uwierzytelniania

- PIN (4-8 cyfr), hashowany bcrypt (10 rund)
- JWT token w httpOnly cookie (`sameSite: strict`, 15-min timeout)
- PIN lockout: 5 nieudanych prób = 5 minut blokady per `subiektUzId` (in-memory)
- Role: `admin` (pełny dostęp) i `operator` (tylko mobile)
- Użytkownicy importowani z `pd_Uzytkownik` Subiekta

## 13. Ryzyka

- `[Ryzyko: Bezpośredni zapis do MSSQL omija logikę biznesową Subiekta — whitelist walidacja ogranicza, ale nie eliminuje ryzyka]`
- `[Ryzyko: PIN lockout in-memory — nie przetrwa restartu serwera (akceptowalne dla obecnej skali)]`
- `[Ryzyko: `trustServerCertificate: true` dla MSSQL — bezpieczne tylko w LAN, ryzykowne dla WAN]`

## 14. Decyzje otwarte

- `[Wymaga decyzji: Kolejność implementacji modułów — inwentaryzacja, kompletacja, czy przyjęcie dostaw?]`
- `[Nieznane: Modele terminali, wersje Androida, DataWedge — czy skanery używane w produkcji?]`
- `[Nieznane: Skala produkcyjna — liczba operatorów, skanów/min, liczba magazynów]`

## 15. Następny krok

Po decyzji użytkownika co do priorytetu modułu — implementacja pionowego wycinka (np. pełny flow inwentaryzacji: wybór zakresu → skanowanie → raport).

## 16. Kryteria akceptacji (bieżące — v1.6.3)

- [x] `npm run build` — przechodzi
- [x] `npm test` — 156 passed / 6 skipped
- [x] `npm run typecheck` — czysto
- [x] `npm run lint` — 0 errors, 0 warnings
- [x] `pomagier-api` — active (systemd), health check OK
- [x] Publiczny URL odpowiada 200 OK
- [x] MSSQL adapter łączy się z Subiektem GT
- [x] Brak sekretów w repo — tylko `{{PLACEHOLDERS}}`
- [x] Auto-logout on 401 (Sprint 5) — globalny handler w `/admin` i `/mobile`
- [x] Global warehouses (Sprint 4) — admin widzi listę w `/admin/erp`, operator widzi dropdown w `/mobile/login`
