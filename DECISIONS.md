# Decision Log — PomagierGT

Każda ważna decyzja architektoniczna zawiera:

- **Kontekst**: co próbujemy osiągnąć, jakie są ograniczenia
- **Rozważane opcje**: co najmniej 2 alternatywy
- **Decyzja**: co zostało wybrane
- **Konsekwencje**: co zyskujemy, co tracimy
- **Sposób wycofania**: jak wrócić do poprzedniego stanu jeśli decyzja okaże się błędna

---

## Decyzje

### 1. Modularny monolit zamiast mikroserwisów

- **Kontekst**: MVP dla jednego magazynu, jeden VPS, mały zespół
- **Rozważane opcje**: (a) mikroserwisy z oddzielnym deployem, (b) modularny monolit Express + React, (c) Next.js full-stack
- **Decyzja**: Modularny monolit — Express 5 API + React 19 SPA, współdzielony proces na VPS
- **Konsekwencje**: prostszy deployment, jeden proces do zarządzania, łatwiejszy debugging. W razie wzrostu można wydzielić connector ERP jako osobny proces
- **Wycofanie**: wydzielenie warstw do osobnych serwisów po granicach domenowych (API vs connector ERP)

### 2. Express 5 jako backend API

- **Kontekst**: potrzeba prostego, sprawdzonego frameworka z TypeScript
- **Rozważane opcje**: (a) Express 5, (b) Fastify, (c) Hono, (d) NestJS
- **Decyzja**: Express 5 — znany ekosystem, middleware, dojrzałość
- **Konsekwencje**: dostęp do wszystkich middleware Express, łatwa integracja z istniejącym kodem. Express 5 ma subtelne różnice w routingu vs Express 4
- **Wycofanie**: migracja do Fastify/Hono jeśli potrzebna wyższa wydajność

### 3. Postgres jako baza aplikacyjna

- **Kontekst**: potrzeba przechowywania danych aplikacji (users, sessions, locations, audit log) niezależnie od MSSQL Subiekta GT
- **Rozważane opcje**: (a) Postgres, (b) SQLite, (c) tylko MSSQL Subiekta
- **Decyzja**: Postgres 16 z Drizzle ORM
- **Konsekwencje**: pełna kontrola nad schematem, niezależność od ERP, łatwe migracje. Dodatkowa baza do zarządzania na VPS
- **Wycofanie**: migracja do SQLite (prościej) lub przeniesienie danych do schematu w MSSQL

### 4. Bezpośredni MSSQL zamiast Sfery GT

- **Kontekst**: Subiekt GT udostępnia dane przez MSSQL i Sferę GT API. Sfera GT wymaga Windows + COM/DCOM
- **Rozważane opcje**: (a) tylko Sfera GT, (b) tylko bezpośredni MSSQL, (c) hybryda
- **Decyzja**: Bezpośredni MSSQL dla odczytu i zapisu. Sfera GT nie jest używana
- **Konsekwencje**: prostsza integracja, dostęp do pełnego schematu, możliwość zapisu do `tw__Towar` (np. `tw_Pole1` dla lokalizacji). Ryzyko: omijanie logiki biznesowej Subiekta
- **Wycofanie**: dodanie warstwy Sfery GT dla operacji zapisu, pozostawienie MSSQL tylko dla odczytu

### 5. JWT httpOnly cookie + bcrypt PIN

- **Kontekst**: uwierzytelnianie operatorów magazynowych na terminalach Android
- **Rozważane opcje**: (a) JWT w localStorage, (b) JWT httpOnly cookie, (c) sesje serwerowe
- **Decyzja**: JWT token w httpOnly cookie (`sameSite: strict`), bcrypt (10 rund) dla PIN-ów, 15-min timeout sesji. Stan użytkownika w localStorage bez tokena (tylko `user` + `operatorName` + `warehouse`)
- **Konsekwencje**: ochrona przed XSS (cookie niedostępne z JS), automatyczne wygasanie. Token nie jest dostępny dla klienta JS — API używa cookie
- **Wycofanie**: powrót do localStorage tokena (mniej bezpieczne) lub przejście na pełne sesje serwerowe

### 6. Lokalizacje w `tw_Pole1` Subiekta GT

- **Kontekst**: potrzeba mapowania produktów na fizyczne lokalizacje w magazynie
- **Rozważane opcje**: (a) osobna tabela w Postgres z sync do Subiekta, (b) tylko tw_Pole1 w Subiekcie, (c) obie bazy zsyncowane
- **Decyzja**: Podwójny zapis — Postgres (`locations`, `product_locations`) jako primary + `tw_Pole1` w Subiekcie jako kopia. Konfigurowalne pole przez `fieldmap_location` (domyślnie `tw_Pole1`)
- **Konsekwencje**: szybkie zapytania lokalne (Postgres), kompatybilność z Subiektem (inni użytkownicy ERP widzą lokalizacje). Ryzyko rozbieżności — endpoint `/api/locations/verify-sync` do wykrywania i `/api/locations/fix-sync` do naprawy
- **Wycofanie**: zaprzestanie zapisu do Subiekta, tylko Postgres

### 7. Whitelist walidacja nazw pól MSSQL (2026-07-27)

- **Kontekst**: `fieldmap_location` pozwala adminowi wybrać pole Subiekta do przechowywania lokalizacji. Wartość była interpolowana bezpośrednio do SQL
- **Rozważane opcje**: (a) parametryzacja (niemożliwa dla nazw kolumn w MSSQL), (b) whitelist, (c) brak walidacji (ryzyko SQL Injection)
- **Decyzja**: Whitelist `ALLOWED_LOCATION_FIELDS` w `getLocationField()` — tylko `tw_Pole1..tw_Pole8`, `tw_Opis`, `tw_Uwagi`
- **Konsekwencje**: eliminacja wektora SQL Injection dla nazw pól. Ograniczenie do 10 pól — wystarczające dla lokalizacji
- **Wycofanie**: rozszerzenie whitelisty o dodatkowe pola

### 8. PIN lockout (2026-07-27)

- **Kontekst**: brak ochrony przed brute-force PIN (4-cyfrowy)
- **Rozważane opcje**: (a) rate limiting per IP, (b) lockout per user w bazie, (c) in-memory lockout
- **Decyzja**: In-memory lockout — 5 nieudanych prób = 5 minut blokady per `subiektUzId`. Czyszczone po udanym logowaniu. Nie wymaga migracji bazy
- **Konsekwencje**: ochrona przed brute-force bez zmiany schematu DB. Nie przetrwa restartu serwera (akceptowalne dla MVP)
- **Wycofanie**: przeniesienie do trwałego storage (tabela w Postgres)

### 9. MSSQL write retry + dual-write compensation (2026-07-31)

- **Kontekst**: zapisy do MSSQL (tw_Pole1) mogą zawieść wskutek chwilowej niedostępności sieci, overdadowania puli połączeń
- **Opcje**: no-retry (500 na klienta), retry + postepowanie (wymaga transakcji rozproszonych 2PC), retry + postep krok-po-kroku (kompensacja)
- **Decyzja**: `writeSubiektWithRetry` (3 próby: 100/200ms) + w endpointie POST `/api/locations/assign` zamknięcie rollbacku: jeśli MSSQL write nie powiedzie się mimo prób, wpis w Postgresie zostaje usunięty ("kompensacja") z rejestracją w logu
- **Konsekwencje**: spójność Postgres↔MSSQL nawet przy przejściowych awariach ERP. Nie chroni przed uszkodzeniem całej transakcji (np. crash API między próbami)
- **Wycofanie**: transakcje rozproszone (MSDTC) jeśli dostępne w sieci Subiekta

### 10. Szyfrowanie mssql_password AES-256-GCM (2026-07-31)

- **Kontekst**: hasło MSSQL przechowywane w tabeli `config` (Postgres) jako plaintext
- **Rozważane opcje**: brak szyfrowania (ryzyko backup-leak), szyfrowanie aplikacyjne (AES-GCM), szyfrowanie na poziomie TDE (wymaga Enterprise)
- **Decyzja**: AES-256-GCM w `crypto-config.ts`, klucz wyprowadzany z `CONFIG_ENCRYPTION_KEY` (fallback: `JWT_SECRET`), random IV per rekord. Fail-closed: błąd szyfrowania = throw (nie plaintext). Prefiks `aes:` dla odróżnienia od starych plaintext wartości
- **Konsekwencje**: backupy Postgresa nie zawierają czystego hasła MSSQL. Rotacja `CONFIG_ENCRYPTION_KEY` wymaga re-encrypt wszystkich wartości w `config.mssql_password`
- **Wycofanie**: przejście na zewnętrzny secret manager (HashiCorp Vault, AWS Secrets Manager)

### 11. POST /api/logout — serwerowa invalidacja sesji (2026-07-31)

- **Kontekst**: wylogowanie na terminalu (dzielony między operatorów) wymagalo natychmiastowej invalidacji sesji serwerowej, nie tylko lokalnej
- **Rozważane opcje**: (a) tylko localStorage clear (sesja żyje do expiracji), (b) DELETE FROM sessions + clear cookie, (c) JWT blacklist
- **Decyzja**: `POST /api/logout` — usuwa sesję z tabeli `sessions` i czyści cookie `token`. Frontend `logout()` wysyła żądanie + czyści localStorage
- **Konsekwencje**: natychmiastowe wylogowanie na dzielonych terminalach. Brak JWT blacklist (token sesji jest losowy, nie JWT)
- **Wycofanie**: dodanie sliding sesji (przedłużanie przy aktywności) jeśli potrzebne

### 12. Whitelist zmniejszona do tw_Pole1-8 (2026-07-31)

- **Kontekst**: `ALLOWED_LOCATION_FIELDS` zawierała `tw_Opis` i `tw_Uwagi` (biznesowe pola opisowe towarów w Subiekcie). Admin mógł ustawić `fieldmap_location` na `tw_Opis`, co nadpisze opisy towarów lokalizacjami
- **Opcje**: (a) zostawić (ryzyko nadpisania), (b) ograniczyć do tw_Pole1-8, (c) dodać runtime check na wartość
- **Decyzja**: ograniczenie whitelist do `tw_Pole1..tw_Pole8` tylko. `tw_Opis` i `tw_Uwagi` usunięte
- **Konsekwencje**: admin nie może nadpisać opisów towarów w Subiekcie przez konfigurację pola. Jeśli aktualnie używa `tw_Opis`, endpoint fallbackuje do `tw_Pole1` i zwraca ostrzeżenie w logu
- **Wycofanie**: przywrócenie `tw_Opis`/`tw_Uwagi` z dodatkową potwierdzącą flagą w config
