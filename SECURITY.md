# Security — PomagierGT

## Zasady ogólne

### Sekrety

Nigdy w repozytorium nie mogą znaleźć się:

- Hasła MSSQL
- Tokeny i klucze API
- Dane dostępowe Sfery GT
- Connection stringi zawierające hasła
- Certyfikaty prywatne

Placeholdery w `.env.example`:

- `{{MSSQL_HOST}}`
- `{{MSSQL_DATABASE}}`
- `{{MSSQL_USER}}`
- `{{MSSQL_PASSWORD}}`
- `{{DATABASE_URL}}`
- `{{JWT_SECRET}}`
- `{{CONFIG_ENCRYPTION_KEY}}`
- `{{BACKUP_ENCRYPTION_KEY}}`

### RBAC i autoryzacja

- Role: `admin` (pełny dostęp panel + API mutacji) i `operator` (terminal mobilny)
- Globalny middleware `requireAuthByDefault` — wszystkie endpointy `/api/*` wymagają sesji (whitelist: `/api/login`, `/api/health`, `/api/company`, `/ca`)
- `requireAdmin` na endpointach administracyjnych (ERP config, field mappings, backup, activity, logs, terminals, wizard, sync)
- Timeout sesji konfigurowalny przez `SESSION_TIMEOUT_MINUTES` (domyślnie 15 min)
- Przypisanie użytkownika do magazynu — [Wymaga decyzji]

### Ochrona danych

- Logi bez danych wrażliwych (pino serializers, redact)
- Maskowanie sekretów w panelu administracyjnym (`••••••••`)
- Audyt działań administracyjnych (audit_log)
- AES-256-GCM szyfrowanie `mssql_password` w tabeli config (klucz z `CONFIG_ENCRYPTION_KEY` lub `JWT_SECRET`)

### OWASP

- SQL injection: parametryzacja wszystkich zapytań MSSQL, whitelist `ALLOWED_LOCATION_FIELDS`
- XSS: CSP headers, `dangerouslySetInnerHTML` tylko w chart.tsx (developer-controlled)
- CSRF: JWT w httpOnly cookie z `SameSite=strict`
- Rate limiting: login 20/min, API 100/min, health 300/min
- Bezpieczne cookies: HttpOnly, Secure (prod), SameSite=strict
- TLS: Caddy (HTTPS) + MSSQL `encrypt: true`
- Idempotencja: `X-Idempotency-Key` header dla assign/undo/transfer
- Correlation ID: `withCorrelation` middleware propaguje ID do wszystkich logów

### Ochrona danych ERP

- Zapis do `tw__Towar` tylko przez whitelist `tw_Pole1-8` (pola dowolnego przeznaczenia)
- `tw_Opis`/`tw_Uwagi` usunięte z whitelist — ochrona biznes-opisów towarów
- Odczyty MSSQL: parametryzowane, timeout 10s, `trustServerCertificate: true` (LAN)
- Retry MSSQL writes: 3 próby z exponential backoff (100/200/400ms)
- Kompensacja dual-write: rollback Postgres przy błędzie MSSQL (assign)
- Przeglądarka NIGDY nie łączy się bezpośrednio z MSSQL

## Stan wdrożenia

- [x] Walidacja zmiennych środowiskowych przy starcie (Zod, env.ts)
- [x] RBAC (requireAuthByDefault + requireAdmin/requireAuth)
- [x] Rate limiting (login 20/min, API 100/min, health 300/min)
- [x] TLS między komponentami (Caddy HTTPS + MSSQL encrypt)
- [x] Idempotencja operacji zapisujących (X-Idempotency-Key, assign/undo/transfer)
- [x] Correlation ID w logach (withCorrelation middleware)
- [x] Maskowanie sekretów w UI admina (••••••••)
- [x] Szyfrowanie sekretów w bazie (AES-256-GCM, crypto-config.ts)
- [x] Backup encryption (gpg AES-256, wykluczenie .env i sessions)
- [x] SIGTERM graceful shutdown (pool.close + server.close)