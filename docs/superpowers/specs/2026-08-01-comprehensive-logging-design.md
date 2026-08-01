# Comprehensive Logging System — Design

**Data**: 2026-08-01
**Status**: Design (approved by user, pending spec review)
**Sprint**: planned after v1.6.3 docs sync

## 1. Problem

Obecny `/admin/logs` pokazuje tylko dwie kategorie:
- `product_movements` (579 wpisów) — ruchy towarów (lokalizacje)
- `audit_log` (486 wpisów: 342 login + 144 login_failed)

**Brakuje**:
- Śladu **kto jaki towar zmienił, jaką metodą (mobile/admin/weryfikacja)**
- Śladu zmian lokalizacji z jakiej na jaką (częściowo w product_movements, bez `method` ani `actor_subiekt_uz_id`)
- Logów admin CRUD (PIN update, role change, config, field mappings, backup)
- Logów ERP query (success >500ms, slow, error, cache miss/hit, retry, compensation)
- Logów offline queue (added, replayed, conflict, idempotency)
- Logów auth events (lockout, session expired, idle logout, 401 redirect)
- Filtrowania, wyszukiwania, date range, eksportu CSV/JSON, szczegółów wpisu

Użytkownik chce: **logować praktycznie wszystko** + widzieć w UI z filtrami i eksportem.

## 2. Cele (per user 2026-08-01)

1. Logować kategorie: admin CRUD, mobile/operator, ERP/MSSQL, offline queue
2. Śledzić **kto jaki towar zmienił, jaką metodą (mobile/admin/weryfikacja)**
3. **Zmiana lokalizacji towaru z jakiej na jaką**
4. Retencja 30 dni (auto-cleanup)
5. UI: full-text search, date range, szczegóły modal, eksport CSV/JSON, filtry user/akcja

## 3. Architektura (high-level)

```
┌────────────────┐
│  /admin/logs   │  ← pełen event log: filter, search, date range, export
│  + filters     │
└───────┬────────┘
        │ GET /api/logs?category=&user=&from=&to=&q=&page=
        ▼
┌──────────────────────────────┐
│  /api/logs (nowe endpointy)  │
│  - GET  (list, filter, search)│
│  - GET  /:id (szczegóły)      │
│  - GET  /export.csv (CSV)     │
│  - GET  /export.json          │
└───────┬──────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│  Postgres                                  │
│  - audit_log (rozszerzony: +category,    │
│    +method, +actor_subiekt_uz_id,          │
│    +target_type, +target_id)               │
│  - product_movements (+method)             │
│  - 30-day cleanup (cron / startup)         │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  Logger (nowy `app-logger.ts`)             │
│  - Dual write: Pino file + Postgres        │
│  - Helper: logEvent({category, action,    │
│    actorSubiektUzId, method, target,        │
│    details}) → oba backendy                │
└──────────────────────────────────────────┘
```

## 4. Schema (Postgres migration `0006_logs_enhancement.sql`)

### 4.1 Rozszerzenie `audit_log`

```sql
-- Nowe kolumny (NULLable dla backward compat)
ALTER TABLE audit_log ADD COLUMN category varchar(20);      -- 'auth' | 'admin' | 'mobile' | 'erp' | 'queue' | 'system'
ALTER TABLE audit_log ADD COLUMN method varchar(20);         -- 'web' | 'mobile' | 'system' | 'verification'
ALTER TABLE audit_log ADD COLUMN actor_subiekt_uz_id integer; -- Subiekt user (nullable)
ALTER TABLE audit_log ADD COLUMN target_type varchar(50);    -- 'user' | 'config' | 'product' | 'location' | 'session' | 'backup'
ALTER TABLE audit_log ADD COLUMN target_id varchar(100);     -- polymorphic ID (uuid/int/string)

-- Backfill istniejących wpisów (486 obecnych: wszystkie auth)
UPDATE audit_log SET category = 'auth' WHERE category IS NULL;
UPDATE audit_log SET method = 'web' WHERE method IS NULL;

-- Indeksy dla UI filterów
CREATE INDEX idx_audit_log_category ON audit_log (category, created_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log (actor_subiekt_uz_id, created_at DESC);
CREATE INDEX idx_audit_log_target ON audit_log (target_type, target_id);
CREATE INDEX idx_audit_log_correlation ON audit_log (correlation_id);
```

### 4.2 Rozszerzenie `product_movements`

```sql
ALTER TABLE product_movements ADD COLUMN method varchar(20);  -- 'mobile' | 'admin' | 'verification' | 'system'
ALTER TABLE product_movements ADD COLUMN actor_subiekt_uz_id integer;
ALTER TABLE product_movements ADD COLUMN correlation_id_idx varchar(36);

-- Index dla szybkiego filtrowania "kto zmienił lokalizację towaru X"
CREATE INDEX idx_pm_product_method ON product_movements (product_id, method, created_at DESC);
```

### 4.3 30-day cleanup

```sql
-- Implementacja: cron-like (w server.ts przy starcie co 24h)
DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '30 days';
DELETE FROM product_movements WHERE created_at < NOW() - INTERVAL '30 days';
```

## 5. Nowy moduł `src/lib/app-logger.ts`

```typescript
interface LogEvent {
  category: 'auth' | 'admin' | 'mobile' | 'erp' | 'queue' | 'system';
  action: string;                     // np. 'user.pin_updated', 'scan.completed', 'erp.query.slow'
  method?: 'web' | 'mobile' | 'system' | 'verification';
  actorSubiektUzId?: number;          // Subiekt operator ID
  actorUserId?: string;              // Pomagier user UUID
  target?: { type: string; id: string };  // np. {type: 'user', id: '3'}
  details?: Record<string, unknown>;  // JSON
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
  correlationId?: string;
}

// Helper - dual write
export async function logEvent(event: LogEvent): Promise<void> {
  // 1. Pino (file + stdout)
  logger.info({ event }, `[${event.category}] ${event.action}`);
  // 2. Postgres (best-effort, never throw)
  try {
    await db.insert(auditLog).values({...});
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log to DB');
  }
}
```

## 6. Coverage — co logujemy

| Kategoria | Akcje | Method | Actor | Target |
|---|---|---|---|---|
| **auth** | `login`, `logout`, `login_failed`, `lockout_activated`, `session_expired`, `idle_logout`, `401_redirect` | web/mobile | subiektUzId | session/user |
| **admin** | `user.pin_updated`, `user.role_updated`, `config.updated` (mssql_*, supported_warehouses, fieldmap), `field_mapping.updated`, `backup.created`, `backup.restored`, `backup.deleted`, `wizard.import_all`, `wizard.clear` | web | admin (subiektUzId=1) | user/config/backup |
| **mobile** | `scan.completed`, `scan.not_found`, `scan.offline_queued`, `scan.replay_ok`, `scan.replay_failed`, `basket.added`, `basket.cleared`, `location.assigned`, `location.transferred`, `location.reset` | mobile | subiektUzId | product/location |
| **erp** | `erp.query.success` (>500ms), `erp.query.slow` (>1s), `erp.query.error`, `erp.cache.miss`, `erp.cache.hit`, `erp.retry`, `erp.compensation` | system | system | product |
| **queue** | `queue.added`, `queue.replayed_ok`, `queue.replayed_failed`, `queue.conflict`, `idempotency.reused` | mobile | subiektUzId | scan/product |
| **system** | `startup`, `shutdown`, `health.fail`, `memory.warning`, `disk.warning` | system | — | — |

**Kluczowy requirement**: "kto jaki towar zmienił, jaką metodą":
- `category='mobile', action='location.assigned', method='mobile' | 'admin' | 'verification'`
- `target={type:'product', id:'1234'}` + `target={type:'location', id:'A 1-2-3-4'}`
- `actor_subiekt_uz_id=5` (operator z Subiekta)
- `details={from: 'A 1-2-3-1', to: 'A 1-2-3-2', qty: 5}`

## 7. Endpoint `/api/logs` (rozszerzenie)

```
GET /api/logs
  ?category=auth|admin|mobile|erp|queue|system  (multi)
  &action=user.pin_updated                       (exact)
  &user=5                                        (actor_subiekt_uz_id)
  &targetType=product&targetId=1234             (polymorphic)
  &from=2026-07-01&to=2026-08-01                (date range)
  &q=5901234567890                              (full-text search: action, details, target_id)
  &method=mobile|web|system|verification        (multi)
  &page=1&pageSize=50                            (pagination, max 200)
  → { rows: [...], total, page, pageSize, stats: {byCategory, byMethod} }

GET /api/logs/:id
  → { ...full event, relatedByCorrelation: [other events with same correlationId] }

GET /api/logs/export.csv?...same filters as GET...
  → text/csv Content-Type, attachment

GET /api/logs/export.json?...same filters...
  → application/json attachment
```

## 8. UI (`/admin/logs`) — redesign

| Sekcja | Funkcja |
|---|---|
| Top bar | Search input (full-text), date range (default: last 7 days) |
| Filters bar | Category multi-select, method multi-select, user dropdown (from Subiekt) |
| Table columns | Time · Category · Method · Actor · Action · Target · Correlation · Details ▶ |
| Row click | Modal z pełnym JSON details + related events (by correlationId) |
| Footer | Pagination + Export CSV / Export JSON buttons |
| KPI row | Total · Today · This week · By category (mini chart) |

## 9. Auto-cleanup (30 dni)

- Implementacja: `setInterval` w `server.ts` startup (co 24h)
- Logged: "Cleanup: deleted N rows from audit_log, M rows from product_movements"
- Manual trigger: `POST /api/admin/logs/cleanup` (admin) — dla ręcznego czyszczenia

## 10. Wpływ na wydajność

| Operacja | Koszt | Mitigation |
|---|---|---|
| Każde skan (mobile) | 1 INSERT do audit_log (~2ms) | Akceptowalne |
| Każde ERP query | SELECT cache (ms) | Log tylko błędy + >500ms |
| Logout/idle | 1 INSERT | Rzadkie |
| Auto-cleanup 30d | DELETE co 24h | Index na created_at |
| UI filters | Query z LIMIT 50 | Indeksy (category, actor, target) |

## 11. Pliki do zmiany (12)

| Plik | Zmiana |
|---|---|
| `src/db/migrations/0006_logs_enhancement.sql` | NOWY — ALTER audit_log + product_movements, indeksy, backfill |
| `src/lib/app-logger.ts` | NOWY — dual write (Pino + Postgres) |
| `src/lib/cleanup.ts` | NOWY — 30-day cleanup |
| `src/api/routes/logs.ts` | NOWY (lub rename activity.ts) — GET /api/logs, /:id, /export |
| `src/api/routes/activity.ts` | UPDATE — użyj nowego app-loggera |
| `src/api/routes/auth.ts` | UPDATE — loguj login/logout/lockout/role/pin |
| `src/api/routes/users.ts` | UPDATE — loguj warehouse assignment (legacy, do usunięcia) |
| `src/api/routes/scan.ts` | UPDATE — loguj scan events (operator, warehouse, duration) |
| `src/api/routes/locations.ts` | UPDATE — loguj assign/transfer/reset (kto, z jakiej na jaką) |
| `src/api/routes/erp-config.ts` | UPDATE — loguj config changes |
| `src/api/routes/backup.ts` | UPDATE — loguj backup operations |
| `src/api/server.ts` | UPDATE — start cleanup interval, register /api/logs |
| `src/routes/admin.logs.tsx` | REDESIGN — filtry, search, date range, modal, export |

## 12. Out of scope (explicit)

- ❌ Pino file log retention (existing: 7 days via pino-roll)
- ❌ Real-time log streaming (SSE/WebSocket)
- ❌ Alerting (np. email przy 5+ failures w minute)
- ❌ Distributed tracing (OpenTelemetry) — to osobny duży projekt
- ❌ Szyfrowanie logów (PII w details) — sensitive fields (PIN, hasła) muszą być maskowane w helper

## 13. Testy

- `tests/unit/lib/app-logger.test.ts` — dual write, never throws
- `tests/unit/lib/cleanup.test.ts` — 30-day window, indexes used
- `tests/integration/logs-endpoints.test.ts` — filtry, search, export, pagination
- Update `tests/unit/routes/wizard-skip.test.ts` — backfill nie psuje istniejących testów

## 14. Self-review

- **Placeholders**: brak
- **Internal consistency**: architektura match feature descriptions ✓
- **Scope**: focused na 1 sprint (1 PRD) — nie wymaga dekompozycji
- **Ambiguity**: jasne (każda akcja ma zdefiniowane pole, retention 30d, scope explicit)
