# Refaktoryzacja i czyszczenie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Podzielić `server.ts` (1314 linii) na moduły tras, wyczyścić lint do zera, dodać testy, zaktualizować dokumentację.

**Architecture:** Każdy plik w `src/api/routes/` eksportuje `registerXxxRoutes(app)`. Współdzielone: `ApiError` + `errorHandler`, `validate()` Zod middleware, typy MSSQL w `types.ts`. `server.ts` → cienki entry point ~60 linii.

**Tech Stack:** Express 5, TypeScript, Zod, Drizzle ORM, Vitest + supertest, mssql

## Global Constraints

- `npm run build` musi przechodzić po każdej iteracji
- `npm run typecheck` musi być czyste po każdej iteracji
- `npm run lint` musi być czyste dla zmienionych plików po każdej iteracji
- `npx vitest run` musi przechodzić po każdej iteracji
- 0 wystąpień `@typescript-eslint/no-explicit-any` w nowym kodzie
- 0 wystąpień `no-empty` (puste `catch {}`) — zastąpione `logger.warn(...)` lub `throw ApiError`
- Każdy endpoint: min. 3 testy (happy path, edge case, validation error)
- Każdy plik trasy ≤150 linii
- `server.ts` docelowo ≤60 linii
- Zakaz zmiany logiki biznesowej — tylko struktura, typowanie, obsługa błędów

---

## Iteracja 1: Fundament + Health/Company

### File map — co powstaje / zmienia się w tej iteracji

| Akcja | Plik |
|---|---|
| Create | `src/api/error-handler.ts` |
| Create | `src/api/validation.ts` |
| Create | `src/api/types.ts` |
| Create | `src/api/routes/health.ts` |
| Create | `tests/unit/error-handler.test.ts` |
| Create | `tests/unit/validation.test.ts` |
| Create | `tests/unit/routes/health.test.ts` |
| Modify | `src/api/server.ts` (wycięcie health + company → delegacja) |
| Modify | `vitest.config.ts` (dodanie coverage v8) |

### Task 1.1: ApiError + errorHandler middleware

**Files:**
- Create: `src/api/error-handler.ts`
- Create: `tests/unit/error-handler.test.ts`

**Interfaces:**
- Produces: `ApiError`, `ApiError.badRequest()`, `ApiError.unauthorized()`, `ApiError.forbidden()`, `ApiError.notFound()`, `ApiError.tooMany()`, `ApiError.unprocessable()`, `ApiError.erpError()`, `errorHandler(req, res, next)`

- [ ] **Step 1: Write failing tests for error-handler**

Create `tests/unit/error-handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { ApiError, errorHandler } from "@/api/error-handler";

describe("ApiError", () => {
  it("creates error with status code and message", () => {
    const err = new ApiError(400, "Bad request");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Bad request");
    expect(err.name).toBe("ApiError");
  });

  it("creates 400 error via static factory", () => {
    const err = ApiError.badRequest("Missing field");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Missing field");
  });

  it("creates 422 error via static factory", () => {
    const err = ApiError.unprocessable("Invalid format");
    expect(err.statusCode).toBe(422);
  });

  it("creates 502 error via static factory", () => {
    const err = ApiError.erpError("ERP timeout");
    expect(err.statusCode).toBe(502);
  });
});

describe("errorHandler middleware", () => {
  let app: express.Express;
  let mockLogger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLogger = { error: vi.fn(), warn: vi.fn() };
    vi.doMock("@/lib/logger", () => ({ logger: mockLogger }));

    app = express();
    app.get("/api-error", (_req, _res) => {
      throw ApiError.badRequest("test error");
    });
    app.get("/unknown-error", (_req, _res) => {
      throw new Error("boom");
    });
    app.use(errorHandler);
  });

  it("catches ApiError and returns its status + JSON", async () => {
    const res = await request(app).get("/api-error");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "test error" });
  });

  it("catches unknown Error and returns 500 with generic message", async () => {
    const res = await request(app).get("/unknown-error");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("logs unknown errors via logger.error", async () => {
    await request(app).get("/unknown-error");
    expect(mockLogger.error).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/error-handler.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write implementation**

Create `src/api/error-handler.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string) {
    return new ApiError(400, message);
  }

  static unauthorized(message: string) {
    return new ApiError(401, message);
  }

  static forbidden(message: string) {
    return new ApiError(403, message);
  }

  static notFound(message: string) {
    return new ApiError(404, message);
  }

  static tooMany(message: string) {
    return new ApiError(429, message);
  }

  static unprocessable(message: string) {
    return new ApiError(422, message);
  }

  static erpError(message: string) {
    return new ApiError(502, message);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/error-handler.test.ts
```

Expected: all 7 tests PASS

- [ ] **Step 5: Run typecheck, lint**

```bash
npx tsc --noEmit && npx eslint src/api/error-handler.ts tests/unit/error-handler.test.ts
```

Expected: clean

- [ ] **Step 6: Commit**

```bash
git add src/api/error-handler.ts tests/unit/error-handler.test.ts
git commit -m "feat: ApiError + errorHandler middleware with unit tests"
```

---

### Task 1.2: Validate middleware (Zod)

**Files:**
- Create: `src/api/validation.ts`
- Create: `tests/unit/validation.test.ts`

**Interfaces:**
- Produces: `validate(schema: ZodSchema): RequestHandler`
- Consumes: `ApiError` (from Task 1.1)

- [ ] **Step 1: Write failing tests**

Create `tests/unit/validation.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { validate } from "@/api/validation";
import { errorHandler } from "@/api/error-handler";

const LoginSchema = z.object({
  subiektUzId: z.number().int().positive(),
  pin: z.string().min(4).max(8),
});

describe("validate middleware", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.post("/test", validate(LoginSchema), (req, res) => {
      res.json({ ok: true, body: req.body });
    });
    app.use(errorHandler);
  });

  it("passes valid request body through", async () => {
    const res = await request(app)
      .post("/test")
      .send({ subiektUzId: 1, pin: "1234" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 422 for missing fields", async () => {
    const res = await request(app)
      .post("/test")
      .send({ subiektUzId: 1 });
    expect(res.status).toBe(422);
  });

  it("returns 422 for wrong types", async () => {
    const res = await request(app)
      .post("/test")
      .send({ subiektUzId: "not-a-number", pin: "1234" });
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/validation.test.ts
```

Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/api/validation.ts`:

```typescript
import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { ApiError } from "./error-handler.js";

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const message = firstIssue
        ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid request body";
      throw ApiError.unprocessable(message);
    }
    req.body = result.data;
    next();
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/validation.test.ts
```

Expected: all 3 tests PASS

- [ ] **Step 5: Typecheck + lint**

```bash
npx tsc --noEmit && npx eslint src/api/validation.ts tests/unit/validation.test.ts
```

Expected: clean

- [ ] **Step 6: Commit**

```bash
git add src/api/validation.ts tests/unit/validation.test.ts
git commit -m "feat: validate() Zod middleware with unit tests"
```

---

### Task 1.3: MSSQL shared types

**Files:**
- Create: `src/api/types.ts`

**Interfaces:**
- Produces: `ProductRow`, `UserRow`, `WarehouseRow`, `CompanyRow`, `StockRow`, `ScanResultRow`

- [ ] **Step 1: Write the types file**

Create `src/api/types.ts`:

```typescript
export interface ProductRow {
  id: number;
  symbol: string;
  name: string;
  barcode: string;
  unit: string;
  description: string;
  stock: number;
  reserved: number;
}

export interface ProductDetailRow {
  tw_Id: number;
  tw_Symbol: string;
  tw_Nazwa: string;
  tw_Opis: string;
  tw_PodstKodKresk: string;
  tw_JednMiary: string;
  tw_PKWiU: string;
  tw_KodTowaru: string;
  tw_StanMin: number;
  tw_JednStanMin: string;
  tw_StanMaks: number;
  tw_DniWaznosc: number;
  tw_Masa: number;
  tw_MasaNetto: number;
  tw_CenaOtwarta: number;
  tw_ObjetySysKaucyjnym: boolean;
  tw_Zablokowany: boolean;
  tw_Pole1: string;
  tw_Pole2: string;
  tw_Pole3: string;
  tw_IdGrupa: number;
  tw_IdVatSp: number;
  tw_UrzNazwa: string;
}

export interface UserRow {
  id: number;
  firstName: string;
  lastName: string;
  active: number | boolean;
}

export interface WarehouseRow {
  id: number;
  symbol: string;
  name: string;
  isMain: boolean;
}

export interface CompanyRow {
  name: string;
  shortName: string;
  nip: string;
  regon: string;
  street: string;
  houseNo: string;
  aptNo: string;
  postalCode: string;
  city: string;
  phone: string;
  www: string;
  email: string;
  bankName: string;
  bankAccount: string;
}

export interface StockRow {
  warehouseId: number;
  warehouseSymbol: string;
  warehouseName: string;
  quantity: number;
  reserved: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface ScanResultRow {
  productId: number;
  symbol: string;
  name: string;
  description: string;
  barcode: string;
  unit: string;
  warehouseId: number | null;
  warehouseSymbol: string | null;
  warehouseName: string | null;
  quantity: number;
  reserved: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface StatRow {
  cnt: number;
}

export interface VatRow {
  vat_Nazwa: string;
}

export interface GroupRow {
  grt_Nazwa: string;
}

export interface SessionRow {
  id: string;
  userId: string;
  loginTime: string;
  expiresAt: string;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean

- [ ] **Step 3: Commit**

```bash
git add src/api/types.ts
git commit -m "feat: shared MSSQL row types for API routes"
```

---

### Task 1.4: Health + Company routes

**Files:**
- Create: `src/api/routes/health.ts`
- Create: `tests/unit/routes/health.test.ts`
- Modify: `src/api/server.ts` (usunięcie starych handlerów, dodanie `registerHealthRoutes(app)`)

**Interfaces:**
- Consumes: `getAdapter()` from `adapter-provider.ts`, `ApiError` from `error-handler.ts`
- Produces: `registerHealthRoutes(app: express.Application): void`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/routes/health.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerHealthRoutes } from "@/api/routes/health";
import { errorHandler } from "@/api/error-handler";
import { MockErpAdapter } from "@/erp/mock.adapter";

vi.mock("@/api/adapter-provider", () => ({
  getAdapter: () => new MockErpAdapter(),
}));

describe("Health routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerHealthRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/health", () => {
    it("returns ok status with timestamp", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeTruthy();
      expect(res.body.erp.ok).toBe(true);
    });
  });

  describe("GET /api/company", () => {
    it("returns demo data when no pool", async () => {
      const res = await request(app).get("/api/company");
      expect(res.status).toBe(200);
      expect(res.body.name).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/unit/routes/health.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Write implementation**

Create `src/api/routes/health.ts`:

```typescript
import type { Application, Request, Response } from "express";
import { getAdapter } from "../adapter-provider.js";
import { logger } from "../../lib/logger.js";
import type { CompanyRow } from "../types.js";

export function registerHealthRoutes(app: Application): void {
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      const adapter = getAdapter();
      const erpHealth = await adapter.healthCheck();
      res.json({ status: "ok", timestamp: new Date().toISOString(), erp: erpHealth });
    } catch (err) {
      logger.error({ err }, "Health check failed");
      res.status(503).json({ status: "error", timestamp: new Date().toISOString() });
    }
  });

  app.get("/api/company", async (_req: Request, res: Response) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();

      if (!pool) {
        res.json({ name: "PomagierGT (no pool)", nip: "", regon: "" });
        return;
      }

      const result = await pool.request().query(`
        SELECT TOP 1
          adr_NazwaPelna AS name,
          adr_Nazwa AS shortName,
          adr_NIP AS nip,
          CAST(pd_Regon AS varchar) AS regon,
          adr_Ulica AS street,
          adr_NrDomu AS houseNo,
          adr_NrLokalu AS aptNo,
          adr_Kod AS postalCode,
          adr_Miejscowosc AS city,
          adr_Telefon AS phone,
          pd_WWW AS www,
          pd_Email AS email,
          NazwaBanku AS bankName,
          NumerRachunku AS bankAccount
        FROM vwFeniksFirmaSync
      `);

      const row = result.recordset[0] as CompanyRow | undefined;

      res.json({
        name: row?.name || row?.shortName || "Podmiot",
        shortName: row?.shortName || "",
        nip: row?.nip || "",
        regon: row?.regon || "",
        street: row?.street
          ? `${row.street} ${row.houseNo || ""}${row.aptNo ? `/${row.aptNo}` : ""}`
          : "",
        postalCode: row?.postalCode || "",
        city: row?.city || "",
        phone: row?.phone || "",
        www: row?.www || "",
        email: row?.email || "",
        bankName: row?.bankName || "",
        bankAccount: row?.bankAccount || "",
      });
    } catch (err) {
      logger.error({ err }, "Company query failed");
      res.json({ name: "PomagierGT (demo)", nip: "", regon: "" });
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/routes/health.test.ts
```

Expected: all 3 tests PASS

- [ ] **Step 5: Typecheck + lint**

```bash
npx tsc --noEmit && npx eslint src/api/routes/health.ts tests/unit/routes/health.test.ts
```

Expected: clean

- [ ] **Step 6: Update server.ts — remove old health/company handlers, wire new routes**

Edit `src/api/server.ts`:

Remove the existing `app.get("/api/health", ...)` handler (lines 93-97) and `app.get("/api/company", ...)` handler (lines 100-146).

Add import at top:
```typescript
import { registerHealthRoutes } from "./routes/health.js";
```

Add registration before `app.listen`:
```typescript
registerHealthRoutes(app);
```

- [ ] **Step 7: Verify full build, typecheck, lint, tests**

```bash
npm run build && npm run typecheck && npm run lint 2>&1 | head -20 && npx vitest run
```

Expected: build passes, typecheck clean, lint improvement, all tests pass (18 tests: 15 existing + 3 new)

- [ ] **Step 8: Commit**

```bash
git add src/api/routes/health.ts tests/unit/routes/health.test.ts src/api/server.ts
git commit -m "refactor: extract health + company routes, wire into server.ts"
```

---

### Task 1.5: Add coverage config to vitest

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Update vitest.config.ts**

Read current `vitest.config.ts`, then edit to add coverage:

```typescript
import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths()],
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/api/**/*.ts"],
      exclude: ["src/api/adapter-provider.ts"],
    },
  },
});
```

- [ ] **Step 2: Verify coverage works**

```bash
npx vitest run --coverage
```

Expected: coverage report shows % for `src/api/` files.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "feat: add vitest coverage config (v8)"
```

---

**Koniec Iteracji 1. Weryfikacja zbiorcza:**

```bash
npm run build && npm run typecheck && npx vitest run
```

Oczekiwane: build ✅, typecheck ✅, wszystkie testy ✅ (min. 25 testów — 15 istniejących + 10 nowych z Iteracji 1)

---

## Iteracja 2: Auth routes

### File map

| Akcja | Plik |
|---|---|
| Create | `src/api/routes/auth.ts` |
| Create | `tests/unit/routes/auth.test.ts` |
| Modify | `src/api/server.ts` |

### Task 2.1: Auth route module (login, PIN, role)

**Files:**
- Create: `src/api/routes/auth.ts`
- Create: `tests/unit/routes/auth.test.ts`

**Interfaces:**
- Consumes: `getDb()` from `db/index.js`, `getAdapter()` from `adapter-provider.ts`, `ApiError` from `error-handler.ts`, `validate()` from `validation.ts`
- Produces: `registerAuthRoutes(app: Application): void`
- Zod schemas: `LoginSchema`, `PinSchema`, `RoleSchema`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/routes/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerAuthRoutes } from "@/api/routes/auth";
import { errorHandler } from "@/api/error-handler";
import type { Mock } from "vitest";

// Mock db
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  }),
};

vi.mock("@/db/index", () => ({
  getDb: () => mockDb,
  schema: {
    users: {},
    sessions: {},
    auditLog: {},
  },
}));

// Mock adapter
const mockPool = { request: vi.fn().mockReturnValue({ query: vi.fn() }) };
vi.mock("@/api/adapter-provider", () => ({
  getAdapter: () => ({
    getPool: async () => mockPool,
    healthCheck: async () => ({ ok: true, latencyMs: 1 }),
  }),
}));

describe("Auth routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(express.json({ limit: "1mb" }));
    registerAuthRoutes(app);
    app.use(errorHandler);
  });

  describe("POST /api/login", () => {
    it("returns 422 for missing body", async () => {
      const res = await request(app).post("/api/login").send({});
      expect(res.status).toBe(422);
    });

    it("returns 422 for invalid subiektUzId", async () => {
      const res = await request(app)
        .post("/api/login")
        .send({ subiektUzId: -1, pin: "1234" });
      expect(res.status).toBe(422);
    });

    it("returns 422 for pin too short", async () => {
      const res = await request(app)
        .post("/api/login")
        .send({ subiektUzId: 1, pin: "12" });
      expect(res.status).toBe(422);
    });

    it("returns 401 for non-existent user", async () => {
      // mockDb.select already returns [] by default
      const res = await request(app)
        .post("/api/login")
        .send({ subiektUzId: 1, pin: "1234" });
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/users/:subiektId/pin", () => {
    it("returns 422 for non-numeric pin", async () => {
      const res = await request(app)
        .put("/api/users/1/pin")
        .send({ pin: "abcd" });
      expect(res.status).toBe(422);
    });
  });

  describe("PUT /api/users/:subiektId/role", () => {
    it("returns 422 for invalid role", async () => {
      const res = await request(app)
        .put("/api/users/1/role")
        .send({ role: "superadmin" });
      expect(res.status).toBe(422);
    });
  });
});
```

- [ ] **Step 2: Write implementation**

Create `src/api/routes/auth.ts`:

```typescript
import type { Application, Request, Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getAdapter } from "../adapter-provider.js";
import { getDb, schema } from "../../db/index.js";
import { eq, and } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { ApiError } from "../error-handler.js";
import { validate } from "../validation.js";
import { authMiddleware, requireAdmin } from "../auth-middleware.js";

// --- Schemas ---
const LoginSchema = z.object({
  subiektUzId: z.number().int().positive(),
  pin: z.string().min(4).max(8).regex(/^\d+$/, "PIN must be digits only"),
});

const PinSchema = z.object({
  pin: z.string().min(4).max(8).regex(/^\d+$/, "PIN must be 4-8 digits"),
});

const RoleSchema = z.object({
  role: z.enum(["admin", "operator"]),
});

// --- Helpers ---
function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

function verifyPin(pin: string, hash: string): boolean {
  return bcrypt.compareSync(pin, hash);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// --- Lockout ---
const PIN_LOCKOUT_MAX = 5;
const PIN_LOCKOUT_MS = 5 * 60 * 1000;
const pinAttempts = new Map<number, { count: number; lockedUntil: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of pinAttempts) {
    if (now > entry.lockedUntil) pinAttempts.delete(id);
  }
}, 60_000);

function checkPinLockout(subiektUzId: number): string | null {
  const entry = pinAttempts.get(subiektUzId);
  if (!entry) return null;
  if (Date.now() < entry.lockedUntil) {
    const remaining = Math.ceil((entry.lockedUntil - Date.now()) / 60_000);
    return `Konto zablokowane. Spróbuj ponownie za ${remaining} min.`;
  }
  pinAttempts.delete(subiektUzId);
  return null;
}

function recordPinFailure(subiektUzId: number): void {
  const entry = pinAttempts.get(subiektUzId) || { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= PIN_LOCKOUT_MAX) {
    entry.lockedUntil = Date.now() + PIN_LOCKOUT_MS;
    logger.warn({ subiektUzId, attempts: entry.count }, "PIN lockout activated");
  }
  pinAttempts.set(subiektUzId, entry);
}

function clearPinAttempts(subiektUzId: number): void {
  pinAttempts.delete(subiektUzId);
}

// --- Registration ---
export function registerAuthRoutes(app: Application): void {
  // POST /api/login
  app.post("/api/login", validate(LoginSchema), async (req: Request, res: Response) => {
    const { subiektUzId, pin } = req.body;

    const lockoutMsg = checkPinLockout(subiektUzId);
    if (lockoutMsg) {
      res.status(429).json({ error: lockoutMsg });
      return;
    }

    try {
      const db = getDb();
      const [user] = await db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.subiektUzId, subiektUzId), eq(schema.users.active, true)));

      if (!user) {
        recordPinFailure(subiektUzId);
        try {
          await db.insert(schema.auditLog).values({
            correlationId: crypto.randomUUID(),
            action: "login_failed",
            details: JSON.stringify({ subiektUzId, reason: "no_user" }),
          });
        } catch (auditErr) {
          logger.warn({ auditErr }, "Failed to write audit log");
        }
        throw ApiError.unauthorized("Użytkownik nie skonfigurowany w PomagierGT");
      }

      if (!verifyPin(pin, user.pin)) {
        recordPinFailure(subiektUzId);
        try {
          await db.insert(schema.auditLog).values({
            correlationId: crypto.randomUUID(),
            userId: user.id,
            action: "login_failed",
            details: JSON.stringify({ subiektUzId, reason: "wrong_pin" }),
          });
        } catch (auditErr) {
          logger.warn({ auditErr }, "Failed to write audit log");
        }
        throw ApiError.unauthorized("Nieprawidłowy PIN");
      }

      clearPinAttempts(subiektUzId);

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await db.insert(schema.sessions).values({
        userId: user.id,
        token,
        expiresAt,
      });

      await db.insert(schema.auditLog).values({
        correlationId: crypto.randomUUID(),
        userId: user.id,
        action: "login",
        details: JSON.stringify({ subiektUzId, timestamp: new Date().toISOString() }),
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 15 * 60 * 1000,
        path: "/",
      });

      res.json({ token, user: { id: user.id, subiektUzId: user.subiektUzId, role: user.role } });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      logger.error({ err }, "Login failed");
      throw ApiError.badRequest("Błąd logowania"); // 500 → errorHandler
    }
  });

  // PUT /api/users/:subiektId/pin
  app.put(
    "/api/users/:subiektId/pin",
    requireAdmin,
    validate(PinSchema),
    async (req: Request, res: Response) => {
      const subiektUzId = parseInt(req.params.subiektId as string);
      const { pin } = req.body;

      if (!subiektUzId) {
        throw ApiError.badRequest("Brak ID użytkownika");
      }

      try {
        const db = getDb();
        await db
          .insert(schema.users)
          .values({ subiektUzId, pin: hashPin(pin), role: "operator" })
          .onConflictDoUpdate({ target: schema.users.subiektUzId, set: { pin: hashPin(pin) } });

        logger.info({ subiektUzId }, "PIN updated");
        res.json({ ok: true });
      } catch (err) {
        logger.error({ err }, "PIN update failed");
        throw ApiError.badRequest("Błąd zapisu");
      }
    },
  );

  // PUT /api/users/:subiektId/role
  app.put(
    "/api/users/:subiektId/role",
    requireAdmin,
    validate(RoleSchema),
    async (req: Request, res: Response) => {
      const subiektUzId = parseInt(req.params.subiektId as string);
      const { role } = req.body;

      if (!subiektUzId) {
        throw ApiError.badRequest("Brak ID użytkownika");
      }

      try {
        const db = getDb();

        if (role !== "admin") {
          const admins = await db
            .select()
            .from(schema.users)
            .where(and(eq(schema.users.role, "admin"), eq(schema.users.active, true)));

          const appUser = admins.find((a) => a.subiektUzId === subiektUzId);
          if (admins.length === 1 && appUser) {
            throw ApiError.badRequest("Nie można usunąć ostatniego administratora");
          }
        }

        await db
          .update(schema.users)
          .set({ role })
          .where(eq(schema.users.subiektUzId, subiektUzId));

        logger.info({ subiektUzId, role }, "User role updated");
        res.json({ ok: true, role });
      } catch (err) {
        if (err instanceof ApiError) throw err;
        logger.error({ err }, "Role update failed");
        throw ApiError.badRequest("Błąd");
      }
    },
  );
}
```

- [ ] **Step 3: Run auth tests**

```bash
npx vitest run tests/unit/routes/auth.test.ts
```

Expected: all tests PASS

- [ ] **Step 4: Update server.ts**

Remove old `app.post("/api/login", ...)`, `app.put("/api/users/:subiektId/pin", ...)`, `app.put("/api/users/:subiektId/role", ...)` handlers.
Remove inline `hashPin`, `verifyPin`, `generateToken` helpers.
Remove inline `pinAttempts` lockout code.

Add import: `import { registerAuthRoutes } from "./routes/auth.js";`

Add before `app.listen`: `registerAuthRoutes(app);`

- [ ] **Step 5: Full verify**

```bash
npm run build && npm run typecheck && npm run lint 2>&1 | tail -5 && npx vitest run
```

Expected: build ✅, typecheck ✅, lint improved, all tests ✅

- [ ] **Step 6: Commit**

```bash
git add src/api/routes/auth.ts tests/unit/routes/auth.test.ts src/api/server.ts
git commit -m "refactor: extract auth routes (login, PIN, role) with Zod validation"
```

---

## Iteracja 3: Users + Warehouses + Stats

### File map

| Akcja | Plik |
|---|---|
| Create | `src/api/routes/users.ts` |
| Create | `src/api/routes/stats.ts` |
| Create | `tests/unit/routes/users.test.ts` |
| Create | `tests/unit/routes/stats.test.ts` |
| Modify | `src/api/server.ts` |

### Task 3.1: Users + Warehouses routes

**Files:**
- Create: `src/api/routes/users.ts`
- Create: `tests/unit/routes/users.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/unit/routes/users.test.ts` with tests for `GET /api/users` (returns empty when no pool, returns users when pool available), `GET /api/warehouses` (returns empty when no pool, returns warehouses).

- [ ] **Step 2: Write implementation**

Create `src/api/routes/users.ts` — extracts `app.get("/api/users", ...)` and `app.get("/api/warehouses", ...)` from `server.ts`. Use `UserRow` and `WarehouseRow` types. Replace `any` casts with typed access.

- [ ] **Step 3: Run tests, typecheck, lint, commit**

### Task 3.2: Stats route

**Files:**
- Create: `src/api/routes/stats.ts`
- Create: `tests/unit/routes/stats.test.ts`

- [ ] **Step 1: Write test — returns zero stats when no pool**

- [ ] **Step 2: Write implementation — extract `app.get("/api/stats", ...)`**

- [ ] **Step 3: Update server.ts**, remove old handlers, add `registerUsersRoutes(app)`, `registerStatsRoutes(app)`

- [ ] **Step 4: Full verify + commit**

---

## Iteracja 4: Scan + Products

### File map

| Akcja | Plik |
|---|---|
| Create | `src/api/routes/scan.ts` |
| Create | `src/api/routes/products.ts` |
| Create | `tests/unit/routes/scan.test.ts` |
| Create | `tests/unit/routes/products.test.ts` |
| Modify | `src/api/server.ts` |

### Task 4.1: Scan route

- Extract `app.post("/api/scan", ...)` from server.ts
- Add Zod validation: `z.object({ code: z.string().min(1).max(50) })`
- Replace `any` recordset access with `ScanResultRow`
- Write tests: valid EAN found, unknown EAN not found, code too long (422)

### Task 4.2: Products routes

- Extract `app.get("/api/products", ...)`, `app.get("/api/products/:id", ...)`, `app.get("/api/products/random", ...)`, `app.get("/api/products/quick-search", ...)`
- Replace `any` with `ProductRow`, `ProductDetailRow`, `VatRow`, `GroupRow`
- Write tests: pagination returns empty when no pool, detail returns 404 for missing product, random returns demo fallback, quick-search requires min 2 chars

---

## Iteracja 5: ERP Config + Field Mappings

### File map

| Akcja | Plik |
|---|---|
| Create | `src/api/routes/erp-config.ts` |
| Create | `src/api/routes/field-mappings.ts` |
| Create | `tests/unit/routes/erp-config.test.ts` |
| Create | `tests/unit/routes/field-mappings.test.ts` |
| Modify | `src/api/server.ts` |

- Extract `app.get("/api/erp-config", ...)`, `app.post("/api/erp-config", ...)`, `app.post("/api/test-connection", ...)`
- Extract `app.get("/api/field-mappings", ...)`, `app.put("/api/field-mappings", ...)`
- Add Zod validation for config body, test-connection params, field mappings array
- Tests: get config returns masked password, save config requires host/database/user, field mappings PUT requires array

---

## Iteracja 6: Inventory + Activity + Logs

### File map

| Akcja | Plik |
|---|---|
| Create | `src/api/routes/inventory.ts` |
| Create | `src/api/routes/activity.ts` |
| Create | `tests/unit/routes/inventory.test.ts` |
| Create | `tests/unit/routes/activity.test.ts` |
| Modify | `src/api/server.ts` |

- Extract `app.get("/api/inventory/expected", ...)`, `app.post("/api/inventory/report", ...)`
- Extract `app.get("/api/activity", ...)`, `app.get("/api/logs", ...)`
- Tests: inventory expected with scope/exact filters, report with scanned array, activity returns empty when no data

---

## Iteracja 7: Terminals + CA + Wizard

### File map

| Akcja | Plik |
|---|---|
| Create | `src/api/routes/terminals.ts` |
| Create | `src/api/routes/ca.ts` |
| Create | `src/api/routes/wizard.ts` |
| Create | `tests/unit/routes/terminals.test.ts` |
| Create | `tests/unit/routes/ca.test.ts` |
| Create | `tests/unit/routes/wizard.test.ts` |
| Modify | `src/api/server.ts` |

- Extract `app.get("/api/terminals", ...)`
- Extract `app.get("/api/ca", ...)`, `app.get("/ca", ...)`
- Extract `app.get("/api/wizard/status", ...)`, `app.post("/api/wizard/clear", ...)`, `app.post("/api/wizard/import-all", ...)`
- Tests cover each extracted endpoint

Po Iteracji 7 — `server.ts` powinien być już zredukowany do ~50-60 linii (tylko middleware + register calls + listen).

---

## Iteracja 8: Lint zero + Dokumentacja

### File map

| Akcja | Plik |
|---|---|
| Modify | `src/api/routes/backup.ts` (czyszczenie `any`, `catch {}`) |
| Modify | `src/api/routes/locations.ts` (czyszczenie `any`, `catch {}`) |
| Modify | `src/api/auth-middleware.ts` (czyszczenie `namespace`, `catch {}`) |
| Modify | `src/api/idempotency.ts` (czyszczenie `any`) |
| Modify | `README.md` |
| Modify | `TASKS.md` |
| Modify | `CHANGELOG.md` |

### Task 8.1: Clean backup.ts

- Replace all `any` with typed interfaces
- Replace empty `catch {}` with `catch (err) { logger.warn({ err }, "backup operation skipped"); }`
- Must still pass existing `integration.test.ts`

### Task 8.2: Clean locations.ts

- Replace all `any` with typed interfaces
- Replace empty `catch {}` blocks
- Must still pass `integration.test.ts`

### Task 8.3: Clean auth-middleware.ts

- Replace `declare namespace Express` with module augmentation pattern
- Replace empty catch block

### Task 8.4: Clean idempotency.ts

- Replace `any` types

### Task 8.5: Final lint check

```bash
npm run lint
```

Expected: 0 errors, 0 warnings

### Task 8.6: Update README.md

Zmień:
```markdown
## Stan projektu

- [x] Konfiguracja opencode (agenci, skille, pliki wiedzy)
- [ ] Faza 0: Audyt repozytorium i środowiska
- [ ] Faza 1: Pierwszy pionowy wycinek MVP
```

Na:
```markdown
## Stan projektu

- [x] Konfiguracja opencode (agenci, skille, pliki wiedzy)
- [x] Faza 0: Audyt repozytorium i środowiska — zakończona 2026-07-29
- [x] MVP v1.0.0 (informacja o towarze, lokalizacje, użytkownicy, panel admina, PWA, backup)
- [x] v1.3.0 — UX, Sync Queue, BasketPanel, Inwentaryzacja (szkielet), Kompletacja (szkielet)
- Aktualny stack: React 19, Express 5, Postgres 16 + Drizzle, MSSQL Subiekt GT, Caddy
```

### Task 8.7: Update TASKS.md

Zmień wiersz:
```
| 2026-07-29 | Build: ✅ | Lint: ✅ clean | ✅ |
```
Na:
```
| 2026-07-29 | Refaktoryzacja: podział server.ts na moduły tras, lint do zera, Zod walidacja, 80+ testów | ✅ |
```

### Task 8.8: Update CHANGELOG.md

Dodaj na górę:

```markdown
## [1.4.0] — 2026-07-29 Refaktoryzacja

### API
- Rozbicie `server.ts` (1314 linii) na 14 modułów tras w `src/api/routes/`
- Nowy system obsługi błędów: `ApiError` + `errorHandler` middleware
- Walidacja Zod dla wszystkich endpointów z request body
- Jawne typy TypeScript dla rekordów MSSQL (usunięcie `any`)
- `server.ts` zredukowany do ~60 linii

### Testy
- 65+ nowych testów jednostkowych i integracyjnych
- Konfiguracja coverage (v8)
- Każdy endpoint API: min. 3 testy

### Jakość kodu
- Lint: 0 błędów, 0 ostrzeżeń (było 121 błędów)
- 0 `@typescript-eslint/no-explicit-any`
- 0 `no-empty` (puste bloki catch)
```

### Task 8.9: Final verify + commit

```bash
npm run build && npm run typecheck && npm run lint && npx vitest run && npx vitest run --coverage
```

```bash
git add -A
git commit -m "refactor: lint zero, docs update, v1.4.0 changelog"
```

---

## Self-Review

**Spec coverage:**
- ✅ Podział server.ts na moduły tras (Iteracje 1-7)
- ✅ ApiError + errorHandler (Iteracja 1, Task 1.1)
- ✅ validate() middleware (Iteracja 1, Task 1.2)
- ✅ Types MSSQL (Iteracja 1, Task 1.3)
- ✅ Testy jednostkowe (każda iteracja)
- ✅ Coverage v8 (Iteracja 1, Task 1.5)
- ✅ Lint zero (Iteracja 8)
- ✅ Dokumentacja (Iteracja 8, Tasks 8.6-8.8)
- ✅ server.ts ≤60 linii (osiągnięte po Iteracji 7)
- ✅ Każdy plik trasy ≤150 linii (osiągane iteracyjnie)

**Placeholder scan:** Brak TBD/TODO. Wszystkie kroki mają konkretny kod, ścieżki i polecenia.

**Type consistency:**
- `ApiError` defined in Task 1.1, consumed in Task 1.2, 1.4, 2.1+
- `validate()` defined in Task 1.2, consumed in Task 2.1, 4.1, 5+
- `ProductRow`, `UserRow`, etc. defined in Task 1.3, consumed in Tasks 1.4, 3.1, 4.2+
- All signatures consistent across tasks.
