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
- `{{ERP_CONNECTOR_TOKEN}}`
- `{{DATABASE_URL}}`
- `{{SESSION_SECRET}}`

### RBAC i autoryzacja

- [Wymaga decyzji: źródło użytkowników — PIN, hasło, LDAP/AD, SSO?]
- Role i uprawnienia z zasadą najmniejszych uprawnień
- Przypisanie użytkownika do magazynu
- Timeout sesji
- Możliwość szybkiej zmiany operatora na terminalu

### Ochrona danych

- Logi bez danych wrażliwych
- Maskowanie sekretów w panelu administracyjnym
- Zakres danych cenowych widocznych dla magazyniera — [Wymaga decyzji]
- Audyt działań administracyjnych

### OWASP

- SQL injection: parametryzacja wszystkich zapytań
- XSS: sanitizacja wyjścia
- CSRF: tokeny dla mutacji
- Rate limiting na endpointach
- Bezpieczne cookies/tokeny (HttpOnly, Secure, SameSite)
- TLS pomiędzy wszystkimi komponentami
- Ochrona przed replay i duplikacją żądań
- Idempotencja operacji zapisujących

### Ochrona danych ERP

- Domyślnie zakaz bezpośredniego zapisu do tabel Subiekta GT
- Zapis tylko przez Sferę GT (chyba że użytkownik jawnie zdecyduje inaczej)
- Odczyty MSSQL: parametryzowane, konto read-only, timeout, monitorowane
- Przeglądarka NIGDY nie łączy się bezpośrednio z MSSQL ani Sferą GT

## Stan wdrożenia

- [ ] Walidacja zmiennych środowiskowych przy starcie
- [ ] RBAC
- [ ] Rate limiting
- [ ] TLS między komponentami
- [ ] Idempotencja operacji zapisujących
- [ ] Correlation ID w logach
- [ ] Maskowanie sekretów w UI admina
