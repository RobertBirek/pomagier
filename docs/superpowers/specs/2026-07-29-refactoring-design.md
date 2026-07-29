# Spec: Refaktoryzacja i czyszczenie kodu — PomagierGT

**Data:** 2026-07-29
**Status:** Zatwierdzony
**Autor:** pomagier (agent)

## 1. Cel

Wyczyszczenie bazy kodu PomagierGT przed dodawaniem kolejnych modułów magazynowych:

- Podział monolitycznego `server.ts` (1314 linii) na moduły tras
- Wyczyszczenie lintu do zera błędów (obecnie 121)
- Aktualizacja nieaktualnej dokumentacji (README, TASKS)
- Dodanie testów jednostkowych i integracyjnych dla API
- Ujednolicenie obsługi błędów i walidacji

## 2. Zakres

### W zakresie

- Rozbicie `src/api/server.ts` na ~14 modułów tras w `src/api/routes/`
- Nowa klasa `ApiError` + Express error handler middleware
- Zod validation middleware dla request body
- Jawne typy TypeScript dla rekordów MSSQL (usunięcie `any`)
- Testy jednostkowe (mock adaptera ERP, mock bazy) — min. 65 nowych
- Testy integracyjne (Express + prawdziwy Postgres dev)
- Konfiguracja coverage (v8) w vitest
- Czyszczenie lintu: 0 błędów `@typescript-eslint/no-explicit-any`, 0 `no-empty`
- Aktualizacja: README.md, TASKS.md, CHANGELOG.md
- `server.ts` zredukowany do ~60 linii (tworzenie app, middleware, register wszystkich tras, listen)

### Poza zakresem

- Zmiana interfejsu `ErpAdapter` ani implementacji `MssqlErpAdapter` / `MockErpAdapter`
- Zmiana schematu bazy Drizzle (`src/db/schema.ts`)
- Zmiana frontendu (komponenty, trasy TanStack Router)
- Zmiana logiki biznesowej endpointów
- Dodawanie nowych funkcjonalności
- Refaktoryzacja `src/erp/mssql.adapter.ts` (tylko czyszczenie lintu jeśli dotknięte)

## 3. Architektura docelowa

### 3.1 Struktura plików

```
src/api/
├── server.ts              ← entry point (~60 linii)
├── adapter-provider.ts    ← istniejący (bez zmian)
├── auth-middleware.ts     ← istniejący (tylko czyszczenie lintu)
├── idempotency.ts         ← istniejący (tylko czyszczenie lintu)
├── error-handler.ts       ← NOWY
├── validation.ts          ← NOWY
├── types.ts               ← NOWY
└── routes/
    ├── health.ts          ← /api/health, /api/company
    ├── auth.ts            ← /api/login, /api/users/:id/pin, /api/users/:id/role
    ├── users.ts           ← /api/users, /api/warehouses
    ├── stats.ts           ← /api/stats
    ├── scan.ts            ← /api/scan
    ├── products.ts        ← /api/products, /api/products/:id, /api/products/random, /api/products/quick-search
    ├── erp-config.ts      ← /api/erp-config, /api/test-connection
    ├── field-mappings.ts  ← /api/field-mappings
    ├── inventory.ts       ← /api/inventory/expected, /api/inventory/report
    ├── activity.ts        ← /api/activity, /api/logs
    ├── terminals.ts       ← /api/terminals
    ├── wizard.ts          ← /api/wizard/status, /api/wizard/clear, /api/wizard/import-all
    ├── ca.ts              ← /api/ca, /ca
    ├── backup.ts          ← istniejący (tylko czyszczenie lintu)
    └── locations.ts       ← istniejący (tylko czyszczenie lintu)
```

### 3.2 Kontrakt modułu trasy

```typescript
// Każdy plik w routes/ eksportuje:
export function registerXxxRoutes(app: express.Application): void;
```

### 3.3 Nowe komponenty współdzielone

#### ApiError

```typescript
export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown);
  static badRequest(msg: string): ApiError;    // 400
  static unauthorized(msg: string): ApiError;  // 401
  static forbidden(msg: string): ApiError;     // 403
  static notFound(msg: string): ApiError;      // 404
  static tooMany(msg: string): ApiError;       // 429
  static unprocessable(msg: string): ApiError; // 422
  static erpError(msg: string): ApiError;      // 502
}
```

#### errorHandler middleware

```typescript
// Express error middleware — ostatni w łańcuchu
// Łapie ApiError → zwraca odpowiedni status + JSON
// Łapie nieznane błędy → loguje jako error, zwraca 500 (bez szczegółów)
```

#### validate() middleware

```typescript
export function validate(schema: z.ZodSchema): RequestHandler;
// Waliduje req.body przez Zod, rzuca ApiError(422) przy błędzie
// Poprawne dane przepisuje do req.body z zachowaniem typu
```

### 3.4 Typy MSSQL

Wszystkie rekordy zwracane przez zapytania MSSQL otrzymują jawne interfejsy w `src/api/types.ts`:

- `ProductRow` — pojedynczy wiersz z `tw__Towar`
- `UserRow` — pojedynczy wiersz z `pd_Uzytkownik`
- `WarehouseRow` — pojedynczy wiersz z `sl_Magazyn`
- `CompanyRow` — pojedynczy wiersz z `vwFeniksFirmaSync`
- `StockRow` — pojedynczy wiersz z `tw_Stan`
- `LocationRow`, `MovementRow`, `AuditRow`, `SessionRow`

## 4. Strategia testów

### 4.1 Struktura

```
tests/
├── auth.test.ts              ← istniejący
├── erp.test.ts               ← istniejący
├── integration.test.ts       ← istniejący (zostają)
├── unit/
│   ├── error-handler.test.ts
│   ├── validation.test.ts
│   └── routes/
│       ├── health.test.ts
│       ├── auth.test.ts
│       ├── users.test.ts
│       ├── stats.test.ts
│       ├── scan.test.ts
│       ├── products.test.ts
│       ├── erp-config.test.ts
│       ├── field-mappings.test.ts
│       ├── inventory.test.ts
│       ├── activity.test.ts
│       ├── terminals.test.ts
│       ├── wizard.test.ts
│       └── ca.test.ts
└── integration/
    ├── health.integration.test.ts
    ├── auth.integration.test.ts
    ├── scan.integration.test.ts
    └── products.integration.test.ts
```

### 4.2 Matryca

| Poziom | Adapter ERP | Baza Postgres | Narzędzie |
|---|---|---|---|
| Unit | MockErpAdapter | Mock (vi.mock) | vitest + supertest |
| Integration | MockErpAdapter | Prawdziwy (dev) | vitest + supertest |
| Existing E2E | Prawdziwy MSSQL | Prawdziwy | vitest + fetch |

### 4.3 Minimum na endpoint

3 testy: happy path + edge case + validation error.

### 4.4 Coverage

- Provider: v8
- Cel: >60% linii w `src/api/`
- Raport: text + lcov

## 5. Harmonogram (8 iteracji)

| # | Iteracja | Endpointy | Nowe testy |
|---|---|---|---|
| 1 | Fundament + Health/Company | types, error-handler, validation, health, company | 9 |
| 2 | Auth | login, PIN, role + Zod schemas | 12 |
| 3 | Users + Warehouses + Stats | users, warehouses, stats | 6 |
| 4 | Scan + Products | scan, products list/detail/random/quick-search | 12 |
| 5 | ERP Config + Field Mappings | config, test-connection, field-mappings | 8 |
| 6 | Inventory + Activity + Logs | inventory expected/report, activity, logs | 9 |
| 7 | Terminals + CA + Wizard | terminals, ca, wizard status/clear/import-all | 9 |
| 8 | Lint zero + Dokumentacja | backup, locations, auth-middleware, README, TASKS, CHANGELOG | - |

## 6. Kryteria akceptacji

- [ ] `npm run build` ✅
- [ ] `npm run typecheck` ✅
- [ ] `npm run lint` ✅ — 0 błędów, 0 ostrzeżeń
- [ ] `npx vitest run` ✅ — wszystkie testy zielone
- [ ] `server.ts` ≤60 linii
- [ ] Każdy plik w `routes/` ≤150 linii
- [ ] Min. 3 testy na każdy endpoint API
- [ ] 0 wystąpień `@typescript-eslint/no-explicit-any`
- [ ] 0 wystąpień `no-empty`
- [ ] README.md odzwierciedla bieżący stan projektu
- [ ] TASKS.md poprawnie raportuje stan lintu i buildu
