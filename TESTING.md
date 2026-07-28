# Testing Standards — PomagierGT

## Poziomy testów

| Poziom | Odpowiedzialność | Narzędzia [Wymaga decyzji] |
|---|---|---|
| Jednostkowe | Logika domenowa, walidacja, mapowanie | Vitest / Jest |
| Integracyjne | API endpointy, adaptery ERP (mock + real) | Supertest / Vitest |
| E2E | Pierwszy flow (happy path + edge case) | Playwright |

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

- [ ] Framework testowy wybrany i skonfigurowany
- [ ] Testy pierwszego flow
- [ ] Testy edge case
- [ ] Testy adversarial
