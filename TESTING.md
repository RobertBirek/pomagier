# Testing Standards — PomagierGT

## Poziomy testów

| Poziom | Odpowiedzialność | Narzędzia |
|---|---|---|
| Jednostkowe (API) | Logika endpointów, walidacja Zod, błędy | Vitest + supertest |
| Jednostkowe (Frontend) | Komponenty React, hooki, renderowanie | Vitest + React Testing Library |
| Integracyjne | Pełne ścieżki Express, mock adaptera ERP | Vitest + supertest |
| E2E | Krytyczne flow (scan, mapa, ERP config) | Playwright |

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

## Stan

- [x] Vitest skonfigurowany z coverage v8
- [x] 85 testów: 65 API (18 plików) + 12 frontend (8 plików)
- [x] React Testing Library + jsdom
- [x] Playwright E2E: 3 scenariusze (scan, map, erp)
- [x] Lint: 0 błędów, 3 ostrzeżenia
