# API Design — PomagierGT

## Stan: v1.6.1 — Produkcyjny

## Autoryzacja

- Sesja: cookie `token` (`HttpOnly`, `SameSite=Strict`, `Secure` w produkcji).
- Publiczne: `POST /api/login`, `GET /api/health`, `GET /api/wizard/status`, `/ca`, `/api/ca`.
- Pozostałe endpointy `/api/*` wymagają sesji; endpointy administracyjne wymagają roli `admin`.
- `POST /api/logout` usuwa sesję z Postgresa i czyści cookie.
- Mutacje lokalizacji obsługują `X-Idempotency-Key` z TTL 5 minut.

## Endpointy (wszystkie pod `/api`)

| Metoda | Ścieżka                      | Moduł             | Opis                                  |
| ------ | ---------------------------- | ----------------- | ------------------------------------- |
| GET    | `/api/health`                | health.ts         | Health check + status ERP             |
| GET    | `/api/company`               | health.ts         | Dane firmy z Subiekta                 |
| POST   | `/api/login`                 | auth.ts           | Logowanie PIN-em                      |
| POST   | `/api/logout`                | auth.ts           | Unieważnienie sesji                   |
| PUT    | `/api/users/:id/pin`         | auth.ts           | Zmiana PIN (admin)                    |
| PUT    | `/api/users/:id/role`        | auth.ts           | Zmiana roli (admin)                   |
| PUT    | `/api/users/:id/warehouse`   | users.ts          | Przypisanie magazynu (admin)          |
| GET    | `/api/users`                 | users.ts          | Lista użytkowników                    |
| GET    | `/api/warehouses`            | users.ts          | Lista magazynów                       |
| GET    | `/api/stats`                 | stats.ts          | KPI (produkty, magazyny, użytkownicy) |
| POST   | `/api/scan`                  | scan.ts           | Skanuj kod EAN/symbol                 |
| POST   | `/api/scan-basket`           | scan.ts           | Skan koszyka                          |
| GET    | `/api/products`              | products.ts       | Lista towarów (paginacja)             |
| GET    | `/api/products/:id`          | products.ts       | Szczegóły towaru                      |
| GET    | `/api/products/code/:code`   | products.ts       | Szczegóły po kodzie/EAN               |
| GET    | `/api/products/random`       | products.ts       | Losowy kod do testów                  |
| GET    | `/api/products/quick-search` | products.ts       | Auto-complete                         |
| GET    | `/api/erp-config`            | erp-config.ts     | Konfiguracja MSSQL                    |
| POST   | `/api/erp-config`            | erp-config.ts     | Zapisz konfigurację                   |
| POST   | `/api/test-connection`       | erp-config.ts     | Test połączenia MSSQL                 |
| GET    | `/api/field-mappings`        | field-mappings.ts | Mapowanie pól                         |
| PUT    | `/api/field-mappings`        | field-mappings.ts | Zapisz mapowanie                      |
| GET    | `/api/inventory/expected`    | inventory.ts      | Oczekiwane stany                      |
| POST   | `/api/inventory/report`      | inventory.ts      | Raport inwentaryzacji                 |
| GET    | `/api/activity`              | activity.ts       | Ostatnie ruchy                        |
| GET    | `/api/logs`                  | activity.ts       | Logi audytu                           |
| GET    | `/api/terminals`             | terminals.ts      | Aktywne sesje                         |
| GET    | `/api/ca`                    | ca.ts             | Certyfikat CA                         |
| GET    | `/ca`                        | ca.ts             | Strona pobierania certyfikatu         |
| GET    | `/api/wizard/status`         | wizard.ts         | Status konfiguracji                   |
| POST   | `/api/wizard/clear`          | wizard.ts         | Wyczyść tabele                        |
| POST   | `/api/wizard/import-all`     | wizard.ts         | Import lokalizacji + użytkowników     |
| *      | `/api/locations/*`           | locations.ts      | CRUD lokalizacji                      |
| *      | `/api/backup/*`              | backup.ts         | Backup i przywracanie                 |

### Lokalizacje — autoryzacja

Odczyty `/api/locations/*` wymagają zalogowania. Mutacje `/assign`, `/undo`, `/transfer`, `/reset`, `/normalize`, `/sync`, `/import`, `/fix-sync`, `/fix-sync-batch` i `/clear-field` wymagają administratora.

## Walidacja

- Endpointy logowania, skanowania i konfiguracji używają Zod przez `validate()`; starsze endpointy lokalizacji i backupu mają walidację ręczną.
- Błędy walidacji zwracają `400` lub `422`: `{ error: "..." }`.
- Globalny error handler: ApiError → odpowiedni status
