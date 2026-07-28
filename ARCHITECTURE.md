# Architecture Decision Record — PomagierGT

## Proponowana architektura (szkic)

### Zasada naczelna

Modularny monolit, nie mikroserwisy. Podział na warstwy logiczne, nie na osobne deployable units — chyba że topologia fizyczna wymusi inaczej.

### Warstwy logiczne

```
┌─────────────────────────────────────────────┐
│               Przeglądarka / PWA             │
│  React + TypeScript + TanStack Router        │
│  Tailwind CSS + shadcn/ui                     │
│  Service Worker (offline cache)              │
└──────────────────┬──────────────────────────┘
                   │ HTTPS + token JWT / cookie
┌──────────────────▼──────────────────────────┐
│              Backend API (VPS Linux)         │
│  [Wymaga decyzji: framework/technologia]     │
│  - Walidacja, RBAC, rate limiting            │
│  - Kolejka operacji, statusy                 │
│  - Structured logging, correlation ID        │
│  - Idempotencja                              │
└──────┬───────────────────────┬──────────────┘
       │                       │
┌──────▼──────┐     ┌──────────▼──────────────┐
│  Baza apl.  │     │   Connector ERP (Windows)│
│  [Dec: PG?] │     │   [Wymaga decyzji]       │
│  - users     │     │   - Sfera GT API         │
│  - roles     │     │   - MSSQL read-only      │
│  - tasks     │     │   - Mapowanie ERP → domena│
│  - queue     │     │   - Health check          │
│  - audit log │     │   - Retry, timeout        │
└─────────────┘     └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  Insert Subiekt GT       │
                    │  MSSQL + Sfera GT         │
                    └─────────────────────────┘
```

### Granice odpowiedzialności

| Komponent | Odpowiada za | NIE odpowiada za |
|---|---|---|
| PWA | UI, skanowanie, offline queue, Service Worker | Bezpośrednie zapytania do MSSQL/Sfery |
| Backend API | Auth, RBAC, walidacja, kolejka, logi, routing do connectora | Bezpośrednie zapytania do MSSQL |
| Connector ERP | Komunikacja z Sferą GT, bezpieczne odczyty MSSQL, mapowanie odpowiedzi | Logika biznesowa, autoryzacja użytkowników |
| MSSQL Subiekta | Stan ERP | Bezpośredni dostęp z przeglądarki lub VPS |

### Topologia

[Wymaga decyzji: czy VPS ma bezpieczne połączenie do sieci z Subiektem? VPN? Tunel?]

[Wymaga decyzji: czy connector ERP działa na tym samym Windows co Subiekt, czy na osobnym serwerze?]

[Wymaga decyzji: Sfera GT — dostępna? W jakiej wersji?]

### Model komunikacji z ERP

- Przeglądarka → Backend API: REST/HTTPS, JSON
- Backend API → Connector ERP: REST/HTTPS, JSON + kolejka
- Connector ERP → MSSQL: TDS (read-only), parametryzowane
- Connector ERP → Sfera GT: [Wymaga decyzji: COM/DCOM, REST?]

## Decyzje architektoniczne

Brak zarejestrowanych decyzji. Pierwsza decyzja zostanie wpisana po Fazie 0.
