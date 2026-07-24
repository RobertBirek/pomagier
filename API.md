# API Design — PomagierGT

## Stan: [Do zaprojektowania po wyborze pierwszego modułu MVP]

API zostanie zaprojektowane po ustaleniu:

1. Pierwszego pionowego wycinka
2. Technologii backendu
3. Modelu danych aplikacji

## Założenia projektowe

- REST/JSON
- Autoryzacja przez token JWT lub secure cookie
- Correlation ID w każdym żądaniu (nagłówek `X-Correlation-ID`)
- Idempotency keys dla mutacji (nagłówek `Idempotency-Key`)
- Rate limiting per user/terminal
- Walidacja wejścia na warstwie API (schematy)
- Centralna obsługa błędów (ujednolicony format `{ error, correlationId, details }`)
- Versioning: `/api/v1/...`

## Przykładowe endpointy (kierunek)

```
GET    /api/v1/health
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/products/{code}
POST   /api/v1/scan-events
GET    /api/v1/tasks
POST   /api/v1/tasks/{id}/complete
```

[Wszystkie endpointy są propozycją — do zweryfikowania podczas projektowania]
