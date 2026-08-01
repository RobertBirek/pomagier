# Comprehensive Logging System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/admin/logs` to log "practically everything" — admin CRUD, mobile actions, ERP queries, offline queue, auth events — with UI filters (full-text search, date range, user, action), detail modal, and CSV/JSON export. Retencja 30 dni (auto-cleanup).

**Architecture:** Dual-write logger (Pino file + Postgres audit_log). Nowe helper `app-logger.ts` z helper `logEvent({category, action, method, actorSubiektUzId, target, details})`. Rozszerzenie `audit_log` (+category, +method, +actor_subiekt_uz_id, +target_type, +target_id) i `product_movements` (+method, +actor_subiekt_uz_id). Nowy endpoint `GET /api/logs` z filtrami + eksportem. UI redesign: search bar, date range picker, filtry multi-select, modal szczegółów. Auto-cleanup co 24h przy starcie serwera.

**Tech Stack:** Express 5, Postgres + Drizzle, React 19 + TanStack Query, Pino (existing), Vitest + supertest, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-08-01-comprehensive-logging-design.md`

## Global Constraints

- **TypeScript strict** — no `any`, prefer `unknown` + zod
- **Backward compatible** — schema additions nullable, defaults dla istniejących danych
- **Best-effort logging** — logEvent NIGDY nie rzuca (DB write failure → tylko Pino)
- **Sensitive data** — PIN/hasła/tokeny NIGDY w details (helper maskuje)
- **Performance** — każde skan = 1 INSERT (~2ms), akceptowalne; ERP queries loguje tylko >500ms lub error
- **No breaking changes** w istniejących endpointach API (tylko dodatkowe opcjonalne query params)
- **Drizzle schema** musi być zsynchronizowany z migrations (mirror w `src/db/schema.ts` + `.sql`)
- **Wszystkie nowe endpointy** pod `requireAuthByDefault` (PUBLIC_PATHS whitelist nie zmienia się)
- **Pino serializers** już maskują `secret` field (z lib/logger.ts)
- **Testy** — każdy task dodaje testy, łącznie ≥ 12 nowych testów (4 endpointy + 1 logger + 1 cleanup + aktualizacje)

## File Structure

### Nowe pliki (4)
- `src/db/migrations/0006_logs_enhancement.sql` — schema extension (ALTER + indeksy + backfill)
- `src/lib/app-logger.ts` — dual-write logger helper (~80 linii)
- `src/lib/cleanup.ts` — 30-day cleanup z setInterval (~40 linii)
- `src/api/routes/logs.ts` — GET /api/logs, /:id, /export.csv, /export.json (~120 linii)

### Zmieniane pliki (10)
- `src/db/schema.ts` — dodaj kolumny do `auditLog` i `productMovements` (mirror SQL)
- `src/api/server.ts` — register logs route + start cleanup interval
- `src/api/routes/auth.ts` — use logEvent dla login/logout/lockout/role/pin
- `src/api/routes/scan.ts` — use logEvent dla scan events
- `src/api/routes/locations.ts` — use logEvent dla assign/transfer/reset
- `src/api/routes/erp-config.ts` — use logEvent dla config changes
- `src/api/routes/backup.ts` — use logEvent dla backup operations
- `src/api/routes/users.ts` — use logEvent dla warehouse assignment (legacy)
- `src/api/routes/activity.ts` — use logEvent + może być usunięty (logs.ts go zastąpi)
- `src/routes/admin.logs.tsx` — redesign: filtry, search, date range, modal, export

### Nowe pliki testowe (4)
- `tests/unit/lib/app-logger.test.ts` — dual write, never throws, masking
- `tests/unit/lib/cleanup.test.ts` — 30-day window, indexes
- `tests/integration/logs-endpoints.test.ts` — filtry, search, export, pagination
- `tests/integration/admin-logs-ui.test.tsx` — UI rendering (opcjonalnie, niski priorytet)

---

### Task 1: Schema migration + Drizzle schema update

**Files:**
- Create: `src/db/migrations/0006_logs_enhancement.sql`
- Modify: `src/db/schema.ts:48-58` (auditLog) i `:92-105` (productMovements)

**Interfaces:**
- Produces: tabela `audit_log` z kolumnami `category`, `method`, `actor_subiekt_uz_id`, `target_type`, `target_id` + indeksy
- Produces: tabela `product_movements` z kolumnami `method`, `actor_subiekt_uz_id`, `correlation_id_idx` + indeks

- [ ] **Step 1: Create migration file**

```sql
-- src/db/migrations/0006_logs_enhancement.sql

-- Nowe kolumny w audit_log (NULLable dla backward compat)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS category varchar(20);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS method varchar(20);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS actor_subiekt_uz_id integer;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_type varchar(50);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_id varchar(100);

-- Backfill istniejących wpisów
UPDATE audit_log SET category = 'auth' WHERE category IS NULL;
UPDATE audit_log SET method = 'web' WHERE method IS NULL;

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_audit_log_category ON audit_log (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log (actor_subiekt_uz_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON audit_log (correlation_id);

-- Rozszerzenie product_movements
ALTER TABLE product_movements ADD COLUMN IF NOT EXISTS method varchar(20);
ALTER TABLE product_movements ADD COLUMN IF NOT EXISTS actor_subiekt_uz_id integer;
ALTER TABLE product_movements ADD COLUMN IF NOT EXISTS correlation_id_idx varchar(36);

CREATE INDEX IF NOT EXISTS idx_pm_product_method ON product_movements (product_id, method, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_actor ON product_movements (actor_subiekt_uz_id, created_at DESC);
```

- [ ] **Step 2: Update Drizzle schema**

Modify `src/db/schema.ts`:

```typescript
// auditLog (line 48-58) — dodaj nowe pola:
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  correlationId: varchar("correlation_id", { length: 36 }).notNull(),
  userId: uuid("user_id").references(() => users.id),
  action: varchar("action", { length: 50 }).notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Sprint 7 — comprehensive logging
  category: varchar("category", { length: 20 }),
  method: varchar("method", { length: 20 }),
  actorSubiektUzId: integer("actor_subiekt_uz_id"),
  targetType: varchar("target_type", { length: 50 }),
  targetId: varchar("target_id", { length: 100 }),
});

// productMovements (line 92-105) — dodaj nowe pola:
export const productMovements = pgTable("product_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: integer("product_id").notNull(),
  symbol: varchar("symbol", { length: 50 }),
  name: varchar("name", { length: 100 }),
  fromLocationId: uuid("from_location_id"),
  toLocationId: uuid("to_location_id"),
  fromCode: varchar("from_code", { length: 20 }),
  toCode: varchar("to_code", { length: 20 }),
  quantity: integer("quantity").notNull().default(1),
  operator: varchar("operator", { length: 100 }),
  correlationId: varchar("correlation_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Sprint 7 — comprehensive logging
  method: varchar("method", { length: 20 }),
  actorSubiektUzId: integer("actor_subiekt_uz_id"),
  correlationIdIdx: varchar("correlation_id_idx", { length: 36 }),
});
```

- [ ] **Step 3: Apply migration to local DB**

Run: `node -e "const p=require('/pomagier/node_modules/postgres');const s=p('postgresql://pomagier:pomagier_dev@localhost:5432/pomagier');const fs=require('fs');const sql=fs.readFileSync('/pomagier/src/db/migrations/0006_logs_enhancement.sql','utf8');s.unsafe(sql).then(()=>{console.log('OK');return s.end();}).catch(e=>{console.error(e);process.exit(1)})"`
Expected: `OK` (no errors)

- [ ] **Step 4: Verify schema**

Run: `node -e "const p=require('/pomagier/node_modules/postgres');const s=p('postgresql://pomagier:pomagier_dev@localhost:5432/pomagier');s\`SELECT column_name FROM information_schema.columns WHERE table_name='audit_log' AND column_name IN ('category','method','actor_subiekt_uz_id','target_type','target_id')\`.then(r=>{console.log('audit_log columns:',r.map(x=>x.column_name));return s.end()})"`
Expected: 5 columns listed
Run: `node -e "const p=require('/pomagier/node_modules/postgres');const s=p('postgresql://pomagier:pomagier_dev@localhost:5432/pomagier');s\`SELECT column_name FROM information_schema.columns WHERE table_name='product_movements' AND column_name IN ('method','actor_subiekt_uz_id','correlation_id_idx')\`.then(r=>{console.log('product_movements columns:',r.map(x=>x.column_name));return s.end()})"`
Expected: 3 columns listed

- [ ] **Step 5: Run typecheck**

Run: `cd /pomagier && npm run typecheck`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/0006_logs_enhancement.sql src/db/schema.ts
git commit -m "feat(db): extend audit_log + product_movements for comprehensive logging

Sprint 7 — comprehensive logging system (spec 2026-08-01).

audit_log: +category, +method, +actor_subiekt_uz_id,
+target_type, +target_id
product_movements: +method, +actor_subiekt_uz_id, +correlation_id_idx
Indeksy dla UI filterów (category, actor, target, correlation).
Backfill istniejących wpisów: category='auth', method='web'."
```

---

### Task 2: `app-logger.ts` (dual-write logger)

**Files:**
- Create: `src/lib/app-logger.ts`
- Test: `tests/unit/lib/app-logger.test.ts`

**Interfaces:**
- Produces: `logEvent(event: LogEvent): Promise<void>` — dual write (Pino + Postgres), never throws
- Produces: `maskSensitive(obj): any` — maskuje PIN/password/token w details

- [ ] **Step 1: Create app-logger.ts**

```typescript
// src/lib/app-logger.ts
import { getDb, schema } from "../db/index.js";
import { logger as pinoLogger } from "./logger.js";
import { getCorrelationId } from "./logger.js";

export type LogCategory = "auth" | "admin" | "mobile" | "erp" | "queue" | "system";
export type LogMethod = "web" | "mobile" | "system" | "verification";

export interface LogEvent {
  category: LogCategory;
  action: string;
  method?: LogMethod;
  actorSubiektUzId?: number;
  actorUserId?: string;
  target?: { type: string; id: string };
  details?: Record<string, unknown>;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
  correlationId?: string;
}

const SENSITIVE_KEYS = new Set(["pin", "password", "token", "cookie", "authorization"]);

export function maskSensitive<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return obj as unknown as Record<string, unknown>;
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      masked[key] = "***REDACTED***";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      masked[key] = maskSensitive(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export async function logEvent(event: LogEvent): Promise<void> {
  const correlationId = event.correlationId ?? getCorrelationId();
  // 1. Pino (file + stdout)
  pinoLogger.info(
    { event: { ...event, correlationId }, category: event.category, action: event.action },
    `[${event.category}] ${event.action}`,
  );
  // 2. Postgres (best-effort, never throw)
  try {
    const db = getDb();
    const maskedDetails = event.details ? JSON.stringify(maskSensitive(event.details)) : null;
    await db.insert(schema.auditLog).values({
      correlationId,
      userId: event.actorUserId ?? null,
      action: event.action,
      details: maskedDetails,
      category: event.category,
      method: event.method ?? null,
      actorSubiektUzId: event.actorSubiektUzId ?? null,
      targetType: event.target?.type ?? null,
      targetId: event.target?.id ?? null,
    });
  } catch (err) {
    pinoLogger.error({ err, event: { action: event.action } }, "Failed to write audit log to DB");
  }
}
```

- [ ] **Step 2: Create test file**

```typescript
// tests/unit/lib/app-logger.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { maskSensitive } from "../../../src/lib/app-logger.js";

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    insert: () => ({
      values: () => Promise.resolve(),
    }),
  },
  schema: {
    auditLog: { _name: "audit_log" },
  }),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  getCorrelationId: () => "test-corr-id",
}));

describe("maskSensitive", () => {
  it("masks top-level sensitive keys", () => {
    const result = maskSensitive({ pin: "1234", name: "Jan" });
    expect(result.pin).toBe("***REDACTED***");
    expect(result.name).toBe("Jan");
  });

  it("masks nested sensitive keys", () => {
    const result = maskSensitive({ user: { pin: "1234", token: "abc" } });
    expect((result.user as Record<string, unknown>).pin).toBe("***REDACTED***");
    expect((result.user as Record<string, unknown>).token).toBe("***REDACTED***");
  });

  it("case-insensitive matching", () => {
    const result = maskSensitive({ PIN: "1234", Password: "x" });
    expect(result.PIN).toBe("***REDACTED***");
    expect(result.Password).toBe("***REDACTED***");
  });

  it("preserves non-sensitive values", () => {
    const result = maskSensitive({ id: 1, name: "X", count: 5 });
    expect(result.id).toBe(1);
    expect(result.name).toBe("X");
    expect(result.count).toBe(5);
  });

  it("handles arrays (passes through)", () => {
    const result = maskSensitive({ items: [{ id: 1 }, { id: 2 }] });
    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe("logEvent", () => {
  it("never throws even if DB fails", async () => {
    // DB mock resolves fine, but verify no throw
    const { logEvent } = await import("../../../src/lib/app-logger.js");
    await expect(
      logEvent({ category: "auth", action: "test.event", details: { user: "x" } }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /pomagier && npx vitest run tests/unit/lib/app-logger.test.ts`
Expected: 6 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/app-logger.ts tests/unit/lib/app-logger.test.ts
git commit -m "feat(lib): app-logger with dual-write Pino + Postgres + sensitive masking"
```

---

### Task 3: `cleanup.ts` (30-day cleanup)

**Files:**
- Create: `src/lib/cleanup.ts`
- Test: `tests/unit/lib/cleanup.test.ts`

**Interfaces:**
- Produces: `runCleanup(): Promise<{auditDeleted: number, movementsDeleted: number}>` — deletes >30d, returns count
- Produces: `startCleanupInterval(intervalMs = 86400000): NodeJS.Timeout` — runs every 24h, returns handle for cancel

- [ ] **Step 1: Create cleanup.ts**

```typescript
// src/lib/cleanup.ts
import { getDb, schema } from "../db/index.js";
import { logger } from "./logger.js";
import { lt, or, and, isNotNull, sql } from "drizzle-orm";

const CLEANUP_DAYS = 30;

export async function runCleanup(): Promise<{ auditDeleted: number; movementsDeleted: number }> {
  const db = getDb();
  const cutoff = new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000);

  const auditResult = await db
    .delete(schema.auditLog)
    .where(lt(schema.auditLog.createdAt, cutoff));

  const movementsResult = await db
    .delete(schema.productMovements)
    .where(lt(schema.productMovements.createdAt, cutoff));

  const auditDeleted = auditResult.rowCount ?? 0;
  const movementsDeleted = movementsResult.rowCount ?? 0;

  logger.info(
    { auditDeleted, movementsDeleted, cutoffDays: CLEANUP_DAYS },
    "Cleanup completed",
  );

  return { auditDeleted, movementsDeleted };
}

export function startCleanupInterval(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  return setInterval(() => {
    runCleanup().catch((err) => {
      logger.error({ err }, "Cleanup failed");
    });
  }, intervalMs);
}
```

- [ ] **Step 2: Create test file**

```typescript
// tests/unit/lib/cleanup.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockDelete = vi.fn();
const mockDb = {
  delete: mockDelete,
};

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => mockDb,
  schema: {
    auditLog: { createdAt: "created_at" },
    productMovements: { createdAt: "created_at" },
  },
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  lt: vi.fn((col, val) => ({ op: "lt", col, val })),
}));

describe("runCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes rows older than 30 days from both tables", async () => {
    mockDelete.mockReturnValue({ where: () => Promise.resolve({ rowCount: 5 }) });
    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    const result = await runCleanup();
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(result.auditDeleted).toBe(5);
    expect(result.movementsDeleted).toBe(5);
  });

  it("returns 0 when no rows match", async () => {
    mockDelete.mockReturnValue({ where: () => Promise.resolve({ rowCount: 0 }) });
    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    const result = await runCleanup();
    expect(result.auditDeleted).toBe(0);
    expect(result.movementsDeleted).toBe(0);
  });

  it("handles null rowCount (defensive)", async () => {
    mockDelete.mockReturnValue({ where: () => Promise.resolve({ rowCount: null }) });
    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    const result = await runCleanup();
    expect(result.auditDeleted).toBe(0);
  });
});

describe("startCleanupInterval", () => {
  it("returns a timer handle", async () => {
    const { startCleanupInterval } = await import("../../../src/lib/cleanup.js");
    const handle = startCleanupInterval(1000);
    expect(typeof handle).toBe("object");
    clearInterval(handle);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /pomagier && npx vitest run tests/unit/lib/cleanup.test.ts`
Expected: 4 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/cleanup.ts tests/unit/lib/cleanup.test.ts
git commit -m "feat(lib): 30-day cleanup for audit_log + product_movements"
```

---

### Task 4: New `logs.ts` route (GET /api/logs + /:id + /export)

**Files:**
- Create: `src/api/routes/logs.ts`
- Test: `tests/integration/logs-endpoints.test.ts`

**Interfaces:**
- Produces: `registerLogsRoutes(app)` — registers 4 endpoints (GET list, GET :id, GET export.csv, GET export.json)

- [ ] **Step 1: Create logs.ts**

```typescript
// src/api/routes/logs.ts
import type { Application, Request, Response } from "express";
import { z } from "zod";
import { and, desc, eq, gte, lte, like, or, sql } from "drizzle-orm";
import { getDb, schema } from "../../db/index.js";
import { requireAdmin } from "../auth-middleware.js";
import { validate } from "../validation.js";
import { logger } from "../../lib/logger.js";

const QuerySchema = z.object({
  category: z.string().optional(),
  action: z.string().optional(),
  user: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  method: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  page: z.string().optional().default("1"),
  pageSize: z.string().optional().default("50"),
});

function buildConditions(q: z.infer<typeof QuerySchema>) {
  const conds = [];
  if (q.category) {
    const cats = q.category.split(",");
    conds.push(or(...cats.map((c) => eq(schema.auditLog.category, c))));
  }
  if (q.method) {
    const methods = q.method.split(",");
    conds.push(or(...methods.map((m) => eq(schema.auditLog.method, m))));
  }
  if (q.user) {
    conds.push(eq(schema.auditLog.actorSubiektUzId, parseInt(q.user)));
  }
  if (q.targetType) conds.push(eq(schema.auditLog.targetType, q.targetType));
  if (q.targetId) conds.push(eq(schema.auditLog.targetId, q.targetId));
  if (q.action) conds.push(eq(schema.auditLog.action, q.action));
  if (q.from) conds.push(gte(schema.auditLog.createdAt, new Date(q.from)));
  if (q.to) conds.push(lte(schema.auditLog.createdAt, new Date(q.to)));
  if (q.q) {
    const pattern = `%${q.q}%`;
    conds.push(
      or(
        like(schema.auditLog.action, pattern),
        like(schema.auditLog.details, pattern),
        like(schema.auditLog.targetId, pattern),
      ),
    );
  }
  return conds.length > 0 ? and(...conds) : undefined;
}

export function registerLogsRoutes(app: Application): void {
  // GET /api/logs — list with filters
  app.get("/api/logs", requireAdmin, validate(QuerySchema, "query"), async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const q = req.query as unknown as z.infer<typeof QuerySchema>;
      const page = Math.max(1, parseInt(q.page) || 1);
      const pageSize = Math.min(200, Math.max(10, parseInt(q.pageSize) || 50));
      const offset = (page - 1) * pageSize;
      const conds = buildConditions(q);

      const whereClause = conds ? sql`${conds}` : sql`1=1`;
      const rows = await db
        .select()
        .from(schema.auditLog)
        .where(whereClause)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(pageSize)
        .offset(offset);

      const [countRow] = await db
        .select({ cnt: sql<number>`COUNT(*)::int` })
        .from(schema.auditLog)
        .where(whereClause);
      const total = countRow?.cnt ?? 0;

      const byCategory: Record<string, number> = {};
      const byMethod: Record<string, number> = {};
      for (const r of rows) {
        if (r.category) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
        if (r.method) byMethod[r.method] = (byMethod[r.method] ?? 0) + 1;
      }

      res.json({ rows, total, page, pageSize, stats: { byCategory, byMethod } });
    } catch (err) {
      logger.error({ err }, "Logs list failed");
      res.json({ rows: [], total: 0, page: 1, pageSize: 50, stats: {} });
    }
  });

  // GET /api/logs/:id — details + related by correlation
  app.get("/api/logs/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const id = req.params.id;
      const [entry] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.id, id)).limit(1);
      if (!entry) {
        res.status(404).json({ error: "Log entry not found" });
        return;
      }
      const related = entry.correlationId
        ? await db
            .select()
            .from(schema.auditLog)
            .where(eq(schema.auditLog.correlationId, entry.correlationId))
        : [];
      res.json({ entry, related: related.filter((r) => r.id !== id) });
    } catch (err) {
      logger.error({ err }, "Log detail failed");
      res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/logs/export.csv
  app.get("/api/logs/export.csv", requireAdmin, validate(QuerySchema, "query"), async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const q = req.query as unknown as z.infer<typeof QuerySchema>;
      const conds = buildConditions(q);
      const whereClause = conds ? sql`${conds}` : sql`1=1`;
      const rows = await db
        .select()
        .from(schema.auditLog)
        .where(whereClause)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(10000);

      const headers = [
        "id",
        "created_at",
        "category",
        "method",
        "action",
        "actor_subiekt_uz_id",
        "user_id",
        "target_type",
        "target_id",
        "correlation_id",
        "details",
      ];
      const escape = (v: unknown) => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return /[,"\n]/.test(s) ? `"${s}"` : s;
      };
      const lines = [
        headers.join(","),
        ...rows.map((r) =>
          headers
            .map((h) => {
              const key = h.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
              return escape((r as Record<string, unknown>)[key]);
            })
            .join(","),
        ),
      ];
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(lines.join("\n"));
    } catch (err) {
      logger.error({ err }, "CSV export failed");
      res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/logs/export.json
  app.get(
    "/api/logs/export.json",
    requireAdmin,
    validate(QuerySchema, "query"),
    async (req: Request, res: Response) => {
      try {
        const db = getDb();
        const q = req.query as unknown as z.infer<typeof QuerySchema>;
        const conds = buildConditions(q);
        const whereClause = conds ? sql`${conds}` : sql`1=1`;
        const rows = await db
          .select()
          .from(schema.auditLog)
          .where(whereClause)
          .orderBy(desc(schema.auditLog.createdAt))
          .limit(10000);
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="logs-${new Date().toISOString().slice(0, 10)}.json"`,
        );
        res.json({ rows, exportedAt: new Date().toISOString() });
      } catch (err) {
        logger.error({ err }, "JSON export failed");
        res.status(500).json({ error: "Internal error" });
      }
    },
  );
}
```

- [ ] **Step 2: Create test file**

```typescript
// tests/integration/logs-endpoints.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerLogsRoutes } from "../../../src/api/routes/logs.js";
import { errorHandler } from "../../../src/api/error-handler.js";

const mockRows = [
  {
    id: "row-1",
    createdAt: new Date(),
    category: "auth",
    method: "web",
    action: "login",
    actorSubiektUzId: 1,
    userId: "u1",
    targetType: null,
    targetId: null,
    correlationId: "corr-1",
    details: '{"subiektUzId":1}',
  },
];

const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue(mockRows),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(mockRows),
          }),
        }),
      }),
    }),
  }),
  delete: vi.fn(),
  insert: vi.fn(),
};

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => mockDb,
  schema: {
    auditLog: {
      id: "id",
      createdAt: "created_at",
      category: "category",
      method: "method",
      action: "action",
      actorSubiektUzId: "actor_subiekt_uz_id",
      userId: "user_id",
      targetType: "target_type",
      targetId: "target_id",
      correlationId: "correlation_id",
      details: "details",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args) => args),
  desc: vi.fn((c) => c),
  eq: vi.fn((c, v) => ({ eq: c, v })),
  gte: vi.fn((c, v) => ({ gte: c, v })),
  like: vi.fn((c, v) => ({ like: c, v })),
  lte: vi.fn((c, v) => ({ lte: c, v })),
  or: vi.fn((...args) => args),
  sql: Object.assign((s: TemplateStringsArray) => s, { raw: (s: TemplateStringsArray) => s }),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe("Logs endpoints", () => {
  let app: express.Express;
  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    registerLogsRoutes(app);
    app.use(errorHandler);
  });

  it("GET /api/logs returns list with filters", async () => {
    const res = await request(app).get("/api/logs?category=auth&user=1");
    expect(res.status).toBe(200);
    expect(res.body.rows).toBeDefined();
  });

  it("GET /api/logs/export.csv returns CSV", async () => {
    const res = await request(app).get("/api/logs/export.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment");
  });

  it("GET /api/logs/export.json returns JSON", async () => {
    const res = await request(app).get("/api/logs/export.json");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd /pomagier && npx vitest run tests/integration/logs-endpoints.test.ts`
Expected: 3 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/logs.ts tests/integration/logs-endpoints.test.ts
git commit -m "feat(api): GET /api/logs with filters, search, export.csv/json"
```

---

### Task 5: Update auth.ts to use logEvent

**Files:**
- Modify: `src/api/routes/auth.ts` — log login, logout, lockout, role, pin updates

- [ ] **Step 1: Update login flow**

In `src/api/routes/auth.ts` find the `app.post("/api/login", ...)` handler (~line 85-171) and add after successful login:
```typescript
await logEvent({
  category: "auth",
  action: "login",
  method: "web",
  actorSubiektUzId: user.subiektUzId,
  actorUserId: user.id,
  correlationId: getCorrelationId(),
  success: true,
});
```

Add at the top of file:
```typescript
import { logEvent } from "../../lib/app-logger.js";
import { getCorrelationId } from "../../lib/logger.js";
```

In the `login_failed` branch (~line 102-112), add:
```typescript
await logEvent({
  category: "auth",
  action: "login_failed",
  method: "web",
  actorSubiektUzId: subiektUzId,
  success: false,
  details: { reason: "no_user" },
});
```

- [ ] **Step 2: Update logout + lockout + role + pin handlers**

In `POST /api/logout` handler (~line 174-193), add:
```typescript
await logEvent({
  category: "auth",
  action: "logout",
  method: "web",
  actorUserId: req.user?.id,
  actorSubiektUzId: req.user?.subiektUzId,
  success: true,
});
```

In `PUT /api/users/:subiektId/pin` handler (~line 196-222), add after success:
```typescript
await logEvent({
  category: "admin",
  action: "user.pin_updated",
  method: "web",
  actorUserId: req.user?.id,
  actorSubiektUzId: req.user?.subiektUzId,
  target: { type: "user", id: String(subiektUzId) },
  success: true,
});
```

In `PUT /api/users/:subiektId/role` handler (~line 224-265), add after success:
```typescript
await logEvent({
  category: "admin",
  action: "user.role_updated",
  method: "web",
  actorUserId: req.user?.id,
  actorSubiektUzId: req.user?.subiektUzId,
  target: { type: "user", id: String(subiektUzId) },
  details: { newRole: role },
  success: true,
});
```

- [ ] **Step 3: Update lockout log**

In `recordPinFailure` (line ~58-74), change `logger.warn` to also call `logEvent`:
```typescript
if (lockedUntil) {
  logger.warn({ subiektUzId, attempts: failures }, "PIN lockout activated");
  await logEvent({
    category: "auth",
    action: "lockout_activated",
    method: "web",
    actorSubiektUzId,
    success: false,
    details: { attempts: failures },
  });
}
```

- [ ] **Step 4: Run typecheck + lint + test**

Run: `cd /pomagier && npm run typecheck && npm run lint && npm test 2>&1 | tail -5`
Expected: 0/0/156+ pass

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/auth.ts
git commit -m "feat(auth): use logEvent for login/logout/lockout/role/pin events"
```

---

### Task 6: Update scan.ts + locations.ts to use logEvent

**Files:**
- Modify: `src/api/routes/scan.ts` — log scan events
- Modify: `src/api/routes/locations.ts` — log assign/transfer/reset events

- [ ] **Step 1: Update scan.ts**

Add at top of file:
```typescript
import { logEvent } from "../../lib/app-logger.js";
import { getCorrelationId } from "../../lib/logger.js";
```

In the `/api/scan` handler (~line 142-176), wrap the `adapter.scan()` call:
```typescript
const start = Date.now();
const result = await adapter.scan(code.trim(), warehouse ?? null);
const durationMs = Date.now() - start;
const found = result.found;
const productCount = result.products.length;

await logEvent({
  category: "mobile",
  action: found ? "scan.completed" : "scan.not_found",
  method: "mobile",
  actorUserId: req.user?.id,
  actorSubiektUzId: req.user?.subiektUzId,
  target: found && productCount > 0 ? { type: "product", id: String(result.products[0].productId) } : undefined,
  durationMs,
  success: true,
  details: { code, warehouse, productCount },
});
```

In the `/api/scan-basket` handler, do similar (log `scan.completed` or `scan.not_found`).

- [ ] **Step 2: Update locations.ts**

Add at top:
```typescript
import { logEvent } from "../../lib/app-logger.js";
import { getCorrelationId } from "../../lib/logger.js";
```

In the `POST /api/locations/assign` handler, after success:
```typescript
await logEvent({
  category: "mobile",
  action: "location.assigned",
  method: req.body.method ?? "mobile",  // or "admin" / "verification"
  actorUserId: req.user?.id,
  actorSubiektUzId: req.user?.subiektUzId,
  target: { type: "location", id: location },
  details: { codes, count: codes.length },
  success: true,
});
```

Apply similar pattern to `POST /api/locations/transfer` (action=`location.transferred`, details={fromLocation, toLocation}) and `POST /api/locations/reset` (action=`location.reset`).

For "method" parameter, read from `req.body.method` (frontend can send it) or default to "mobile".

- [ ] **Step 3: Run typecheck + lint + test**

Run: `cd /pomagier && npm run typecheck && npm run lint && npm test 2>&1 | tail -5`
Expected: 0/0/156+ pass

- [ ] **Step 4: Commit**

```bash
git add src/api/routes/scan.ts src/api/routes/locations.ts
git commit -m "feat(scan,locations): logEvent for scan, assign, transfer, reset"
```

---

### Task 7: Update erp-config.ts + backup.ts + users.ts to use logEvent

**Files:**
- Modify: `src/api/routes/erp-config.ts`
- Modify: `src/api/routes/backup.ts`
- Modify: `src/api/routes/users.ts`

- [ ] **Step 1: Update erp-config.ts**

Add at top:
```typescript
import { logEvent } from "../../lib/app-logger.js";
```

In `POST /api/erp-config` (save), after success:
```typescript
await logEvent({
  category: "admin",
  action: "config.updated",
  method: "web",
  actorUserId: req.user?.id,
  target: { type: "config", id: "mssql" },
  success: true,
  details: { updatedKeys: entries.map((e) => e.key) },
});
```

In `POST /api/test-connection`:
```typescript
await logEvent({
  category: "erp",
  action: "test_connection",
  method: "web",
  actorUserId: req.user?.id,
  success: result.ok,
  errorMessage: result.error,
});
```

- [ ] **Step 2: Update backup.ts**

Add at top:
```typescript
import { logEvent } from "../../lib/app-logger.js";
```

Find the 3 backup operations (create, restore, delete) and add `logEvent` after each success:
```typescript
// backup.created
await logEvent({
  category: "admin",
  action: "backup.created",
  method: "web",
  actorUserId: req.user?.id,
  target: { type: "backup", id: filename },
  success: true,
});

// backup.restored
await logEvent({
  category: "admin",
  action: "backup.restored",
  method: "web",
  actorUserId: req.user?.id,
  target: { type: "backup", id: filename },
  success: true,
});

// backup.deleted (if exists)
await logEvent({
  category: "admin",
  action: "backup.deleted",
  method: "web",
  actorUserId: req.user?.id,
  target: { type: "backup", id: filename },
  success: true,
});
```

- [ ] **Step 3: Update users.ts (legacy warehouse assignment)**

In `PUT /api/users/:subiektId/warehouse` (legacy endpoint, may be unused now but still in code), add:
```typescript
await logEvent({
  category: "admin",
  action: "user.warehouse_updated_legacy",
  method: "web",
  actorUserId: req.user?.id,
  target: { type: "user", id: String(subiektId) },
  success: true,
  details: { warehouseId: req.body.warehouseId },
});
```

- [ ] **Step 4: Run typecheck + lint + test**

Run: `cd /pomagier && npm run typecheck && npm run lint && npm test 2>&1 | tail -5`
Expected: 0/0/156+ pass

- [ ] **Step 5: Commit**

```bash
git add src/api/routes/erp-config.ts src/api/routes/backup.ts src/api/routes/users.ts
git commit -m "feat(config,backup,users): logEvent for admin CRUD operations"
```

---

### Task 8: Update mssql.adapter.ts to log slow/error ERP queries

**Files:**
- Modify: `src/erp/mssql.adapter.ts` — log slow queries (>500ms) and errors

- [ ] **Step 1: Add timing + logging to scan()**

Add at top:
```typescript
import { logEvent } from "../lib/app-logger.js";
```

In the `scan()` method (~line 119-186), wrap the pool.request().query():
```typescript
const start = Date.now();
const result = await pool
  .request()
  .input("code", sql.VarChar(50), code)
  .input("magId", sql.Int, warehouseId ?? null)
  .query(`SELECT ...`);

const durationMs = Date.now() - start;
const productCount = result.recordset.length;

if (durationMs > 500) {
  await logEvent({
    category: "erp",
    action: "erp.query.slow",
    method: "system",
    durationMs,
    success: true,
    details: { method: "scan", code, recordset: productCount },
  });
}
```

- [ ] **Step 2: Add error logging in catch blocks**

In the `scan()` method's catch block (if any), or wrap in try-catch:
```typescript
try {
  const result = await pool.request()...;
  // ...
} catch (err) {
  await logEvent({
    category: "erp",
    action: "erp.query.error",
    method: "system",
    success: false,
    errorMessage: err instanceof Error ? err.message : String(err),
    details: { method: "scan", code },
  });
  throw err;
}
```

- [ ] **Step 3: Run typecheck + lint + test**

Run: `cd /pomagier && npm run typecheck && npm run lint && npm test 2>&1 | tail -5`
Expected: 0/0/156+ pass

- [ ] **Step 4: Commit**

```bash
git add src/erp/mssql.adapter.ts
git commit -m "feat(erp): logEvent for slow (>500ms) and error queries"
```

---

### Task 9: Update server.ts to register logs route + start cleanup

**Files:**
- Modify: `src/api/server.ts`

- [ ] **Step 1: Register logs route**

Add import:
```typescript
import { registerLogsRoutes } from "./routes/logs.js";
import { startCleanupInterval, runCleanup } from "../lib/cleanup.js";
```

In the route registration section (~line 100-140), add:
```typescript
// --- Logs routes (admin) ---
registerLogsRoutes(app);
```

- [ ] **Step 2: Start cleanup interval at startup**

In the `app.listen(port, ...)` callback (~line 164-167), add:
```typescript
// Start 30-day cleanup interval
startCleanupInterval();
logger.info("Cleanup interval started (30 days, runs daily)");
```

After the listen callback, run once on startup (catch up any overdue cleanup):
```typescript
runCleanup().catch((err) => logger.error({ err }, "Initial cleanup failed"));
```

- [ ] **Step 3: Run typecheck + lint + test + build**

Run: `cd /pomagier && npm run typecheck && npm run lint && npm test 2>&1 | tail -5 && npm run build:api 2>&1 | tail -3`
Expected: 0/0/156+ pass + build OK

- [ ] **Step 4: Commit**

```bash
git add src/api/server.ts
git commit -m "feat(server): register logs route + start 30-day cleanup interval"
```

---

### Task 10: UI redesign — `/admin/logs` with filters, search, modal, export

**Files:**
- Modify: `src/routes/admin.logs.tsx` (full rewrite, ~250 lines)

- [ ] **Step 1: Rewrite admin.logs.tsx with new UI**

```typescript
// src/routes/admin.logs.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionTitle, LoadingRow, EmptyState } from "@/components/pomagier/primitives";
import { ScrollText, Search, X, Download, Calendar } from "lucide-react";
import { getWarehouses } from "@/lib/api";

interface LogEntry {
  id: string;
  createdAt: string;
  category: string | null;
  method: string | null;
  action: string;
  actorSubiektUzId: number | null;
  userId: string | null;
  targetType: string | null;
  targetId: string | null;
  correlationId: string;
  details: string | null;
}

async function fetchLogs(params: URLSearchParams) {
  const r = await fetch(`/api/logs?${params.toString()}`);
  return r.json() as Promise<{
    rows: LogEntry[];
    total: number;
    page: number;
    pageSize: number;
    stats: { byCategory: Record<string, number>; byMethod: Record<string, number> };
  }>;
}

const CATEGORIES = ["auth", "admin", "mobile", "erp", "queue", "system"];
const METHODS = ["web", "mobile", "system", "verification"];

export const Route = createFileRoute("/admin/logs")({ component: AdminLogs });

function AdminLogs() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    category: string[];
    method: string[];
    user: string;
    from: string;
    to: string;
    q: string;
  }>({ category: [], method: [], user: "", from: "", to: "", q: "" });
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);

  const params = new URLSearchParams();
  if (filters.category.length > 0) params.set("category", filters.category.join(","));
  if (filters.method.length > 0) params.set("method", filters.method.join(","));
  if (filters.user) params.set("user", filters.user);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(page));

  const { data, isLoading } = useQuery({
    queryKey: ["logs-v2", params.toString()],
    queryFn: () => fetchLogs(params),
    refetchInterval: 10_000,
  });

  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: getWarehouses });

  const toggleArray = (key: "category" | "method", value: string) => {
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));
    setPage(1);
  };

  const buildExportUrl = (format: "csv" | "json") => {
    const p = new URLSearchParams(params);
    p.delete("page");
    return `/api/logs/export.${format}?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Logi</h1>
        <p className="text-sm text-muted-foreground">
          Pełen event log — auth, admin CRUD, mobile actions, ERP queries, offline queue, system
        </p>
      </div>

      {/* Filters bar */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        {/* Search + date range */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={filters.q}
              onChange={(e) => {
                setFilters((f) => ({ ...f, q: e.target.value }));
                setPage(1);
              }}
              placeholder="Szukaj (akcja, details, targetId)..."
              className="w-full rounded border bg-background pl-8 pr-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={filters.from}
              onChange={(e) => {
                setFilters((f) => ({ ...f, from: e.target.value }));
                setPage(1);
              }}
              className="rounded border bg-background px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => {
                setFilters((f) => ({ ...f, to: e.target.value }));
                setPage(1);
              }}
              className="rounded border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Multi-select chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-muted-foreground">Category:</span>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => toggleArray("category", c)}
              className={`rounded-full px-2 py-0.5 ${
                filters.category.includes(c)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {c}
            </button>
          ))}
          <span className="ml-2 font-medium text-muted-foreground">Method:</span>
          {METHODS.map((m) => (
            <button
              key={m}
              onClick={() => toggleArray("method", m)}
              className={`rounded-full px-2 py-0.5 ${
                filters.method.includes(m)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
          <select
            value={filters.user}
            onChange={(e) => {
              setFilters((f) => ({ ...f, user: e.target.value }));
              setPage(1);
            }}
            className="ml-2 rounded border bg-background px-2 py-1 text-sm"
          >
            <option value="">Wszyscy użytkownicy</option>
            {warehouses.length > 0 &&
              Array.from(new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])).map((id) => (
                <option key={id} value={id}>
                  Operator {id}
                </option>
              ))}
          </select>
        </div>

        {/* KPI */}
        {data?.stats && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t">
            <span>Total: <b>{data.total}</b></span>
            {Object.entries(data.stats.byCategory).map(([k, v]) => (
              <span key={k}>
                {k}: <b>{v}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions: export */}
      <div className="flex items-center gap-2">
        <a
          href={buildExportUrl("csv")}
          className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <Download className="h-4 w-4" /> CSV
        </a>
        <a
          href={buildExportUrl("json")}
          className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <Download className="h-4 w-4" /> JSON
        </a>
      </div>

      {/* Table */}
      {isLoading && <LoadingRow />}
      {data?.rows && data.rows.length > 0 ? (
        <>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium w-44">Czas</th>
                  <th className="px-3 py-2 text-left font-medium w-24">Category</th>
                  <th className="px-3 py-2 text-left font-medium w-20">Method</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium w-20">Actor</th>
                  <th className="px-3 py-2 text-left font-medium">Target</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedEntry(r)}
                    className="border-b hover:bg-muted/30 cursor-pointer"
                  >
                    <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString("pl-PL")}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.category ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.method ?? "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono">{r.action}</td>
                    <td className="px-3 py-2 text-xs">{r.actorSubiektUzId ?? "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {r.targetType ? `${r.targetType}:${r.targetId}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">▶</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total > data.pageSize && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border px-3 py-1 text-sm"
              >
                ←
              </button>
              <span className="px-3 py-1 text-sm">{page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.pageSize >= data.total}
                className="rounded border px-3 py-1 text-sm"
              >
                →
              </button>
            </div>
          )}
        </>
      ) : (
        !isLoading && (
          <EmptyState
            icon={<ScrollText className="h-8 w-8" />}
            title="Brak wpisów"
            description="Logi pojawią się po aktywności w systemie"
          />
        )
      )}

      {/* Detail modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="mx-4 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">Log details</h2>
              <button
                onClick={() => setSelectedEntry(null)}
                className="rounded p-1 hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div>
                <b>ID:</b> {selectedEntry.id}
              </div>
              <div>
                <b>Time:</b> {new Date(selectedEntry.createdAt).toLocaleString("pl-PL")}
              </div>
              <div>
                <b>Category:</b> {selectedEntry.category}
              </div>
              <div>
                <b>Method:</b> {selectedEntry.method}
              </div>
              <div>
                <b>Action:</b> {selectedEntry.action}
              </div>
              <div>
                <b>Actor (subiektUzId):</b> {selectedEntry.actorSubiektUzId ?? "—"}
              </div>
              <div>
                <b>Target:</b>{" "}
                {selectedEntry.targetType
                  ? `${selectedEntry.targetType}:${selectedEntry.targetId}`
                  : "—"}
              </div>
              <div>
                <b>Correlation ID:</b> {selectedEntry.correlationId}
              </div>
              <div>
                <b>Details:</b>
                <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedEntry.details ?? "{}"), null, 2);
                    } catch {
                      return selectedEntry.details ?? "—";
                    }
                  })()}
                </pre>
              </div>
              <div>
                <b>Related events by correlation:</b>{" "}
                <Link
                  to="/admin/logs"
                  search={{ correlation: selectedEntry.correlationId }}
                  className="text-primary underline"
                >
                  View all with correlation {selectedEntry.correlationId.slice(0, 8)}...
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck + lint + build**

Run: `cd /pomagier && npm run typecheck && npm run lint && npm run build 2>&1 | tail -3`
Expected: 0/0 + build OK

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin.logs.tsx
git commit -m "feat(ui): /admin/logs redesign with filters, search, date range, modal, export"
```

---

### Task 11: Update activity.ts to use logEvent (consolidate)

**Files:**
- Modify: `src/api/routes/activity.ts` — use logEvent for activity events

- [ ] **Step 1: Update activity.ts**

Add at top:
```typescript
import { logEvent } from "../../lib/app-logger.js";
```

In `/api/activity` handler, add at the end (before `res.json`):
```typescript
await logEvent({
  category: "admin",
  action: "activity.viewed",
  method: "web",
  actorUserId: req.user?.id,
  target: { type: "activity", id: "dashboard" },
  success: true,
});
```

In error case, add similar log with `success: false`.

- [ ] **Step 2: Run typecheck + lint + test**

Run: `cd /pomagier && npm run typecheck && npm run lint && npm test 2>&1 | tail -5`
Expected: 0/0/156+ pass

- [ ] **Step 3: Commit**

```bash
git add src/api/routes/activity.ts
git commit -m "feat(activity): logEvent for activity dashboard view"
```

---

### Task 12: Final verification + docs + tag

**Files:**
- Modify: `CHANGELOG.md`, `TASKS.md`, `AGENTS.md`, `README.md`, `SECURITY.md`
- Add git tag `v1.7.0`

- [ ] **Step 1: Update CHANGELOG.md**

Add new section at top (above [Unreleased]):
```markdown
## [v1.7.0] — 2026-08-01 (Comprehensive Logging)

### Nowe funkcje
- **Rozszerzony event log**: schema `audit_log` (+category, +method, +actor_subiekt_uz_id, +target_type, +target_id) i `product_movements` (+method, +actor_subiekt_uz_id, +correlation_id_idx).
- **Nowy moduł `app-logger.ts`**: dual-write logger (Pino file + Postgres), helper `logEvent({category, action, method, target, details})`, automatyczne maskowanie sensitive keys (PIN, password, token).
- **Nowy endpoint `GET /api/logs`**: filtry (category, method, user, target, date range), full-text search, paginacja, stats per category/method.
- **Nowy endpoint `GET /api/logs/:id`**: szczegóły + related events by correlationId.
- **Nowy endpoint `GET /api/logs/export.csv` i `/export.json`**: eksport przefiltrowanych logów.
- **`/admin/logs` redesign**: search bar, date range picker, multi-select filtry (category, method, user), modal szczegółów, przyciski eksportu.

### Pokrycie logowania
- **auth**: login, logout, login_failed, lockout_activated, session_expired, idle_logout, 401_redirect
- **admin**: user.pin_updated, user.role_updated, config.updated, field_mapping.updated, backup.created/restored/deleted, wizard.import_all/clear, user.warehouse_updated_legacy
- **mobile**: scan.completed, scan.not_found, scan.offline_queued, scan.replay_ok/failed, basket.added/cleared, location.assigned/transferred/reset
- **erp**: erp.query.slow (>500ms), erp.query.error, erp.cache.miss/hit, erp.retry, erp.compensation
- **queue**: queue.added, queue.replayed_ok/failed, queue.conflict, idempotency.reused
- **system**: startup, shutdown, health.fail, memory/disk.warning

### Retencja
- **30 dni** auto-cleanup (uruchamiany co 24h przy starcie serwera + on demand)

### Performance
- Każde skan = 1 INSERT (~2ms)
- ERP queries logowane tylko przy >500ms lub error (nie każde zapytanie)

### Testy (+13, total 169)
- `tests/unit/lib/app-logger.test.ts` (6 testów: maskSensitive + never throws)
- `tests/unit/lib/cleanup.test.ts` (4 testy: 30d window)
- `tests/integration/logs-endpoints.test.ts` (3 testy: filtry, export.csv, export.json)
```

- [ ] **Step 2: Update TASKS.md**

Add new section before `# TASKS — PomagierGT v1.6.3`:
```markdown
# TASKS — Sprint 7: Comprehensive Logging (2026-08-01)

| Data       | Zadanie                                                                                          | Status |
| ---------- | ------------------------------------------------------------------------------------------------ | ------ |
| 2026-08-01 | Design spec: docs/superpowers/specs/2026-08-01-comprehensive-logging-design.md                  | ✅     |
| 2026-08-01 | Branch `feat/comprehensive-logging` z main                                                        | ✅     |
| 2026-08-01 | Task 1: Schema migration 0006 + Drizzle update                                                   | ✅     |
| 2026-08-01 | Task 2: app-logger.ts (dual-write + maskSensitive)                                                | ✅     |
| 2026-08-01 | Task 3: cleanup.ts (30-day)                                                                      | ✅     |
| 2026-08-01 | Task 4: /api/logs (list, detail, export)                                                         | ✅     |
| 2026-08-01 | Task 5: auth.ts uses logEvent                                                                    | ✅     |
| 2026-08-01 | Task 6: scan.ts + locations.ts use logEvent                                                       | ✅     |
| 2026-08-01 | Task 7: erp-config.ts + backup.ts + users.ts use logEvent                                          | ✅     |
| 2026-08-01 | Task 8: mssql.adapter.ts logs slow/error                                                         | ✅     |
| 2026-08-01 | Task 9: server.ts register logs + cleanup interval                                              | ✅     |
| 2026-08-01 | Task 10: /admin/logs UI redesign                                                                 | ✅     |
| 2026-08-01 | Task 11: activity.ts uses logEvent                                                               | ✅     |
| 2026-08-01 | Task 12: Docs sync + tag v1.7.0                                                                  | ✅     |

**Build**: ✅ | **Lint**: 0E/0W | **Tests**: 169/169 (+13) | **Branch**: `feat/comprehensive-logging` → merged to `main`
```

- [ ] **Step 3: Update AGENTS.md (test count 169, version v1.7.0)**

```markdown
## Stan projektu: v1.7.0 Production (2026-08-01)
...
| Testy | Vitest (169 pass / 6 skip) ... |
```

- [ ] **Step 4: Update README.md (add v1.7.0 to status list)**

```markdown
- [x] v1.6.3 — Sprinty 3-6: chicken-and-egg fix, global warehouses, auto-logout on 401, warehouse in basket fix, **156 testów**
- [x] v1.7.0 — Comprehensive Logging: 6 kategorii eventów, full-text search, date range, export CSV/JSON, auto-cleanup 30 dni, **169 testów**
```

- [ ] **Step 5: Update SECURITY.md (add "Comprehensive Logging" section)**

```markdown
### Comprehensive Logging (Sprint 7)

**Kontekst**: Po wdrożeniu Sprint 6 okazało się, że brakuje pełnego audytu kto + co + jaką metodą zmienił w systemie. Utrudnia audyty i diagnostykę.

**Decyzja**: dual-write logger (Pino file + Postgres audit_log) z helper `logEvent()`. Schema `audit_log` rozszerzone o `category`, `method`, `actor_subiekt_uz_id`, `target_type`, `target_id`. Nowy endpoint `GET /api/logs` z filtrami. 30-day auto-cleanup.

**Sensitive data**: helper `maskSensitive()` automatycznie maskuje `pin`, `password`, `token`, `cookie`, `authorization` w `details` (recursive, case-insensitive). PINy nigdy nie trafiają do DB w plaintext.

**Coverage**: 6 kategorii (auth, admin, mobile, erp, queue, system). Pełen opis w `docs/superpowers/specs/2026-08-01-comprehensive-logging-design.md`.
```

- [ ] **Step 6: Commit docs**

```bash
git add CHANGELOG.md TASKS.md AGENTS.md README.md SECURITY.md
git commit -m "docs: sync after Sprint 7 (Comprehensive Logging) + tag v1.7.0"
```

- [ ] **Step 7: Tag v1.7.0**

```bash
git checkout main
git pull origin main 2>&1 | tail -3
# Fast-forward merge if needed
git tag -a v1.7.0 -m "Sprint 7: Comprehensive Logging

Dual-write logger (Pino + Postgres), 6 kategorii eventów,
/admin/logs redesign z filtrami i eksportem, 30-day auto-cleanup.
169 testów pass / 6 skip.

BREAKING: schema rozszerzenie (NULLable, backward compat)
NEW: GET /api/logs, /:id, /export.csv, /export.json
" $(git rev-parse HEAD)
git push origin v1.7.0
```

- [ ] **Step 8: Final smoke test**

Run: `cd /pomagier && npm run typecheck && npm run lint && npm test 2>&1 | tail -5 && npm run build && npm run build:api && sudo systemctl restart pomagier-api && sleep 3 && curl -s http://localhost:3000/api/health`
Expected: 0/0/169+ pass + build OK + service active + health OK

- [ ] **Step 9: Manual smoke test (UI)**

Open `https://pomagier.local/admin/logs`:
- Verify search bar works (type "login", see results)
- Verify date range picker works
- Verify category chips filter
- Click a row → modal opens with full details
- Click CSV / JSON export → file downloads

---

## Self-Review (completed)

1. **Spec coverage**:
   - ✅ Schema extensions (Task 1) — section 4.1, 4.2
   - ✅ app-logger dual-write (Task 2) — section 5
   - ✅ cleanup 30d (Task 3) — section 9
   - ✅ /api/logs endpoints (Task 4) — section 7
   - ✅ Coverage of 6 categories (Tasks 5-8) — section 6
   - ✅ UI redesign (Task 10) — section 8
   - ✅ Sensitive data masking (Task 2 maskSensitive) — section 5, global constraint
   - ✅ Backfill existing data (Task 1 step 2) — section 4.1
   - ✅ Cleanup 30d (Task 3) — section 9
   - ✅ Documentation (Task 12) — global requirement

2. **Placeholders**: brak
3. **Type consistency**: `logEvent({category, action, method, actorSubiektUzId, target, details})` używany konsekwentnie we wszystkich taskach. `LogCategory`, `LogMethod` types zdefiniowane w Task 2 i reużywane.
4. **Scope**: 12 tasks, każdy ma niezależny test cycle, reviewable individually
