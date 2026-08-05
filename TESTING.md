# Testing Standards — PomagierGT

## Aktualny stan

- Vitest: **303 passed / 6 skipped**
- Nowe scenariusze: pełne czyszczenie lokalizacji, idempotency key, walidacja kodów i rollback Subiekta.

## Poziomy testów

| Poziom                 | Odpowiedzialność                         | Narzędzia                      |
| ---------------------- | ---------------------------------------- | ------------------------------ |
| Jednostkowe (API)      | Logika endpointów, walidacja Zod, błędy  | Vitest + supertest             |
| Jednostkowe (Frontend) | Komponenty React, hooki, renderowanie    | Vitest + React Testing Library |
| Integracyjne           | Pełne ścieżki Express, mock adaptera ERP | Vitest + supertest             |
| E2E                    | Krytyczne flow (scan, mapa, ERP config)  | Playwright                     |

## Scenariusze testowe dla każdego flow

### Happy Path

1. Operator loguje się
2. Wykonuje podstawową operację (np. skanowanie kodu)
3. System zwraca poprawny wynik
4. Zdarzenie zostaje zapisane w logu audytowym
5. Odpowiedź w akceptowalnym czasie

### Edge Case

1. Nieznany kod wejściowy
2. ERP/backend chwilowo niedostępny
3. Wielokrotne kliknięcia (bez duplikatów)
4. Ponowienia żądań
5. Jednoznaczny stan błędu w UI
6. Correlation ID w logach, bez sekretów

### Adversarial

- Bardzo długi kod wejściowy
- Niedozwolone znaki
- SQL injection
- XSS
- Wielokrotne szybkie skany
- Wielokrotne kliknięcia „Zatwierdź"
- Wygasła sesja
- Brak uprawnień
- Podszycie się pod inny terminal
- Ponowne wysłanie tego samego żądania
- Brak odpowiedzi ERP
- Częściowa awaria synchronizacji
- Manipulowanie identyfikatorem zadania
- Próba odczytu danych innego magazynu

## Kryteria akceptacji wycinka

- [ ] Aplikacja uruchamia się zgodnie z dokumentacją
- [ ] Build przechodzi
- [ ] Lint przechodzi
- [ ] Typecheck przechodzi
- [ ] Testy przechodzą
- [ ] UI zachowuje spójność z design systemem
- [ ] Flow działa od początku do końca
- [ ] Mock i realny adapter mają oddzielne implementacje
- [ ] Błędy są obsłużone
- [ ] Operacje są logowane
- [ ] Brak sekretów w repozytorium
- [ ] Dokumentacja odpowiada rzeczywistemu stanowi

## Stan (v1.6.3, 2026-08-01)

- [x] Vitest skonfigurowany z coverage v8
- [x] **156 testów pass / 6 skip** (38 plików testowych)
- [x] React Testing Library + jsdom
- [x] Playwright E2E: 3 scenariusze (scan, map, erp)
- [x] Lint: 0 błędów, 0 ostrzeżeń
- [x] Typecheck: 0 błędów

### Podział testów (po Sprintach 3-6)

| Sprint   | Plik testowy                                         | Testy                                                    |
| -------- | ---------------------------------------------------- | -------------------------------------------------------- |
| Sprint 3 | `tests/unit/auth-middleware.test.ts`                 | 17 (PUBLIC_PATHS verification)                           |
| Sprint 3 | `tests/unit/routes/wizard-skip.test.ts`              | 5 (skip param + default PIN 0000)                        |
| Sprint 4 | `tests/unit/routes/erp-supported-warehouses.test.ts` | 6 (GET/PUT/auto-default)                                 |
| Sprint 4 | `tests/unit/routes/scan.test.ts` (update)            | 6 (admin bez warehouse, operator wymaga)                 |
| Sprint 4 | `tests/unit/routes/users.test.ts` (update)           | 3 (brak warehouseId, filtrowane, PUT 404)                |
| Sprint 5 | `tests/unit/use-401-redirect.test.tsx`               | 6 (subscribe, 401, no-401, login page, success, unmount) |
| Sprint 5 | `tests/unit/use-auto-logout.test.tsx`                | 4 (admin, mobile, no user, click reset)                  |
| Sprint 6 | `tests/unit/use-basket.test.tsx`                     | 3 (warehouse w body, fallback, dedupe)                   |
