# Architecture Decision Record — PomagierGT

## Architektura (aktualna — v1.6.1)

### Zasada naczelna

Modularny monolit, nie mikroserwisy. Podział na warstwy logiczne w ramach jednego procesu Express na VPS. MSSQL adapter osadzony bezpośrednio w API — bez osobnego connectora.

### Warstwy logiczne

```
┌─────────────────────────────────────────────┐
│               Przeglądarka / PWA             │
│  React 19 + TypeScript + TanStack Router     │
│  Tailwind CSS 4 + shadcn/ui                  │
│  Service Worker (Workbox, offline cache)     │
│  ScanHeader: keyboard wedge / kamera / manual│
└──────────────────┬──────────────────────────┘
                   │ HTTPS (Caddy) + JWT httpOnly cookie
┌──────────────────▼──────────────────────────┐
│           Express 5 API (VPS Linux)          │
│  - Walidacja (Zod), RBAC (admin/operator)   │
│  - Rate limiting, Helmet, CORS              │
│  - Idempotencja (X-Idempotency-Key)          │
│  - Structured logging (Pino + pino-roll)     │
│  - Embedded MSSQL adapter (MssqlErpAdapter)  │
│  - Adapter provider (MSSQL / Mock fallback)  │
└──────┬───────────────────────┬──────────────┘
       │                       │
┌──────▼──────────┐  ┌─────────▼──────────────┐
│  Postgres 16    │  │  Insert Subiekt GT      │
│  (Drizzle ORM)  │  │  MSSQL Server (Windows) │
│                 │  │                         │
│  Tabele:        │  │  Odczyt:                │
│  - users        │  │  - tw__Towar, tw_Stan   │
│  - sessions     │  │  - sl_Magazyn           │
│  - audit_log    │  │  - pd_Uzytkownik        │
│  - config       │  │  - vwFeniksFirmaSync    │
│  - locations    │  │  - uf_SynchroKodyKresk  │
│  - product_     │  │  - sl_StawkaVAT         │
│    locations    │  │  - sl_GrupaTw            │
│  - product_     │  │                         │
│    movements    │  │  Zapis (whitelist):      │
│                 │  │  - tw__Towar (tw_Pole1..│
│                 │  │    tw_Pole8, tw_Opis,   │
│                 │  │    tw_Uwagi)             │
└─────────────────┘  └─────────────────────────┘
```

### Granice odpowiedzialności

| Komponent | Odpowiada za | NIE odpowiada za |
|---|---|---|
| PWA | UI, skanowanie (ScanHeader), kolejka offline (IndexedDB), Service Worker | Bezpośrednie zapytania do MSSQL/Sfery |
| Express API | Auth (JWT, bcrypt), RBAC, walidacja, kolejka, logi, routing | Logika biznesowa ERP |
| MssqlErpAdapter | Parametryzowane zapytania MSSQL, mapowanie wyników na modele domenowe, health check | Autoryzacja użytkowników, rate limiting |
| Postgres | Dane aplikacyjne (users, sessions, locations, audit, config) | Dane ERP (towary, dokumenty, kontrahenci) |
| MSSQL Subiekta | Stan ERP — odczyt i whitelist-zapis | Bezpośredni dostęp z przeglądarki lub zewnętrznych serwisów |

### Topologia

- **VPS Linux** (Ubuntu 26.04): Express API + Postgres + Caddy + statyczne pliki PWA
- **Serwer Windows w sieci lokalnej**: MSSQL Subiekt GT
- **Połączenie**: VPS → MSSQL przez sieć lokalną (TDS, port 1433)
- **Sfera GT**: niedostępna — wszystkie operacje przez bezpośredni MSSQL
- **Connector ERP**: nie istnieje jako osobny komponent — MssqlErpAdapter osadzony w Express API

### Model komunikacji z ERP

- Przeglądarka → Caddy: HTTPS/2, HTTP/3 (port 443)
- Caddy → Express API: HTTP reverse proxy (localhost:3000)
- Express API → MSSQL: TDS (port 1433), parametryzowane zapytania, timeout 10s
- Express API → Postgres: TCP (localhost:5432)
- Tylko odczyt z MSSQL dla większości operacji
- Zapis do MSSQL tylko przez whitelist-walidowane pola (lokalizacje w `tw_Pole1`)

## Decyzje architektoniczne

Wszystkie decyzje są rejestrowane w [DECISIONS.md](./DECISIONS.md).

| # | Decyzja | Data |
|---|---|---|
| 1 | Modularny monolit zamiast mikroserwisów | 2026-07-24 |
| 2 | Express 5 jako backend API | 2026-07-24 |
| 3 | Postgres jako baza aplikacyjna | 2026-07-24 |
| 4 | Bezpośredni MSSQL zamiast Sfery GT | 2026-07-24 |
| 5 | JWT httpOnly cookie + bcrypt PIN | 2026-07-24 |
| 6 | Lokalizacje w tw_Pole1 Subiekta GT (podwójny zapis) | 2026-07-25 |
| 7 | Whitelist walidacja nazw pól MSSQL | 2026-07-27 |
| 8 | PIN lockout in-memory (5 prób / 5 min) | 2026-07-27 |

## Decyzje otwarte

- `[Wymaga decyzji: Kolejność implementacji modułów magazynowych — inwentaryzacja vs kompletacja vs przyjęcie dostaw]`
- `[Wymaga decyzji: Czy potrzebny jest osobny connector ERP na Windows — obecnie embedded adapter działa, ale może być ograniczeniem przy większej skali]`
