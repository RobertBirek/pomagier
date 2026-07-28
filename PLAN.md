# Plan v0 — PomagierGT

## Stan: W trakcie implementacji (Faza 1 — feat/mvp-foundation)

## 1. Podsumowanie projektu

PomagierGT — aplikacja PWA dla magazynu, stanowiąca warstwę operacyjną między operatorami terminali a systemem ERP Insert Subiekt GT.

## 2. Cel pierwszej wersji

Pierwsza wersja implementuje moduł **"Informacja o towarze po skanie"** — operator loguje się PIN-em, skanuje kod EAN, aplikacja odczytuje dane z MSSQL Subiekta GT i wyświetla kartę produktu ze stanami magazynowymi.

## 3. Ustalone fakty

- VPS: Ubuntu 26.04, 6.2 GB RAM, 57 GB SSD, Docker v29.6.2, Node.js v22
- MSSQL Subiekt GT: dostępny w sieci lokalnej, 44 towary, 2 magazyny (MAG, MAP)
- UI: React 19, TanStack Router, Tailwind 4, shadcn/ui
- Repo produkcyjne: `/pomagier` na branchu `feat/mvp-foundation`

## 4. Założenia

- `[Założenie robocze: MSSQL dostępny w sieci lokalnej z kontenera Docker — używa credentials z MCP]`
- `[Założenie robocze: Postgres 16 jako baza aplikacyjna]`
- `[Założenie robocze: Auth przez PIN (demo), JWT do API]`

## 5. Ograniczenia

- `[Ograniczenie: Tylko odczyt MSSQL — bez zapisów]`
- `[Ograniczenie: Brak Sfery GT — tylko bezpośredni odczyt MSSQL]`
- `[Ograniczenie: Brak offline / Service Worker]`
- `[Ograniczenie: Admin panel to statyczne makiety]`

## 6. Pierwszy pionowy wycinek

**Informacja o towarze po skanie EAN**

Flow:
1. Operator wybiera profil + PIN → logowanie
2. Dashboard mobilny z kafelkami modułów
3. Skaner → skan EAN / wpisanie ręczne
4. `scanCode()` server function → adapter MSSQL → `tw__Towar` + `tw_Stan` + `sl_Magazyn`
5. Karta produktu: symbol, nazwa, jednostka, stany per magazyn

## 7. Elementy poza zakresem pierwszej iteracji

- Kompletacja, inwentaryzacja, dostawy (makiety)
- Sfera GT, offline, Service Worker
- Produkcyjny deployment (tylko Docker Compose dev)
- RBAC (tylko szkielet z PIN-ami)

## 8. Architektura logiczna

```
Przeglądarka / PWA (React 19, TanStack Start, Tailwind CSS 4, shadcn/ui)
    │
    ▼
Nitro Server (SSR + API — server functions)
    ├── Postgres 16 (Drizzle ORM: users, roles, sessions, audit_log)
    └── MSSQL Adapter (odczyt Subiekt GT)
```

## 9. Topologia wdrożenia

- Docker Compose: `app` (Vite dev + HMR) + `postgres:16-alpine`
- MSSQL: zewnętrzny serwer w sieci lokalnej
- Dev: Vite HMR na `:5173`, Postgres na `:5432`

## 10. Granice odpowiedzialności

| Komponent | Odpowiada za |
|---|---|
| PWA / SSR | UI, routing, auth (JWT), wywoływanie server functions |
| Nitro Server | SSR, server functions (scanCode, healthCheck) |
| MSSQL Adapter | Bezpieczny odczyt `tw__Towar`, `tw_Stan`, `sl_Magazyn` |
| Postgres | Użytkownicy aplikacji, role, sesje, audit log |

## 11. Model komunikacji z ERP

- Przeglądarka → Nitro: server function (`createServerFn`)
- Nitro → MSSQL: `mssql` package, parametryzowane zapytania, timeout 10s
- Tylko read-only, konto z MCP

## 15. Strategia uwierzytelniania

- Demo: PIN (4 cyfry) z mock-data
- JWT token, httpOnly cookie
- Timeout sesji: 15 minut
- `[Poza zakresem MVP: produkcyjne auth]`

## 18. Ryzyka

- `[Ryzyko: MSSQL może być niedostępny z kontenera Docker — fallback na mock adapter]`
- `[Ryzyko: @tanstack/react-start jest w wersji beta — API może się zmienić]`

## 19. Decyzje otwarte

- `[Wymaga decyzji: Produkcyjne uwierzytelnianie — LDAP/AD/SSO?]`
- `[Wymaga decyzji: Sfera GT — dostępna?]`
- `[Nieznane: Modele terminali, DataWedge?]`

## 22. Kryteria akceptacji

- [x] `npm run build` — przechodzi
- [x] `npm run typecheck` — czysto
- [x] `npm run lint` — czysto
- [ ] `docker compose up` — aplikacja na `localhost:5173`
- [ ] Flow end-to-end: login PIN → skan → karta produktu
- [ ] Mock adapter działa bez MSSQL
- [ ] MSSQL adapter działa z bazą testową
- [ ] Brak sekretów w repo — tylko `{{PLACEHOLDERS}}`
