# API Design — PomagierGT

## Stan: v1.5.0 — Produkcyjny

## Endpointy (wszystkie pod `/api`)

| Metoda | Ścieżka | Moduł | Opis |
|---|---|---|---|
| GET | `/api/health` | health.ts | Health check + status ERP |
| GET | `/api/company` | health.ts | Dane firmy z Subiekta |
| POST | `/api/login` | auth.ts | Logowanie PIN-em |
| PUT | `/api/users/:id/pin` | auth.ts | Zmiana PIN (admin) |
| PUT | `/api/users/:id/role` | auth.ts | Zmiana roli (admin) |
| GET | `/api/users` | users.ts | Lista użytkowników |
| GET | `/api/warehouses` | users.ts | Lista magazynów |
| GET | `/api/stats` | stats.ts | KPI (produkty, magazyny, użytkownicy) |
| POST | `/api/scan` | scan.ts | Skanuj kod EAN/symbol |
| GET | `/api/products` | products.ts | Lista towarów (paginacja) |
| GET | `/api/products/:id` | products.ts | Szczegóły towaru |
| GET | `/api/products/random` | products.ts | Losowy kod do testów |
| GET | `/api/products/quick-search` | products.ts | Auto-complete |
| GET | `/api/erp-config` | erp-config.ts | Konfiguracja MSSQL |
| POST | `/api/erp-config` | erp-config.ts | Zapisz konfigurację |
| POST | `/api/test-connection` | erp-config.ts | Test połączenia MSSQL |
| GET | `/api/field-mappings` | field-mappings.ts | Mapowanie pól |
| PUT | `/api/field-mappings` | field-mappings.ts | Zapisz mapowanie |
| GET | `/api/inventory/expected` | inventory.ts | Oczekiwane stany |
| POST | `/api/inventory/report` | inventory.ts | Raport inwentaryzacji |
| GET | `/api/activity` | activity.ts | Ostatnie ruchy |
| GET | `/api/logs` | activity.ts | Logi audytu |
| GET | `/api/terminals` | terminals.ts | Aktywne sesje |
| GET | `/api/ca` | ca.ts | Certyfikat CA |
| GET | `/ca` | ca.ts | Strona pobierania certyfikatu |
| GET | `/api/wizard/status` | wizard.ts | Status konfiguracji |
| POST | `/api/wizard/clear` | wizard.ts | Wyczyść tabele |
| POST | `/api/wizard/import-all` | wizard.ts | Import lokalizacji + użytkowników |
| * | `/api/locations/*` | locations.ts | CRUD lokalizacji |
| * | `/api/backup/*` | backup.ts | Backup i przywracanie |

## Walidacja

- Wszystkie endpointy z body: Zod schema przez middleware `validate()`
- Błędy walidacji: 422 `{ error: "..." }`
- Globalny error handler: ApiError → odpowiedni status
