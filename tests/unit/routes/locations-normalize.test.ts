import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerLocationsRoutes } from "../../../src/api/routes/locations.js";
import { errorHandler } from "../../../src/api/error-handler.js";

const mockGetPool = vi.fn();

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuthByDefault: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  ops: { kind: string; table: string }[];
}

function buildDbMock(): MockDb {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (v: unknown[]) => void) => resolve([])),
  };
  const db: MockDb = {
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockImplementation((t: unknown) => {
      db.ops.push({ kind: "insert", table: tagOf(t) });
      return {
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue([]),
        }),
      };
    }),
    update: vi.fn().mockImplementation((t: unknown) => {
      db.ops.push({ kind: "update", table: tagOf(t) });
      return {
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      };
    }),
    delete: vi.fn().mockImplementation((t: unknown) => {
      db.ops.push({ kind: "delete", table: tagOf(t) });
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
    transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({
        select: vi.fn().mockReturnValue(chain),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
    }),
    ops: [],
  };
  return db;
}

function tagOf(t: unknown): string {
  const obj = t as Record<string, unknown> | null | undefined;
  if (!obj || typeof obj !== "object") return "unknown";
  if ("quantity" in obj && "locationId" in obj) return "product_locations";
  if ("area" in obj && "code" in obj) return "locations";
  return "other";
}

let activeDbMock: MockDb;

vi.mock("../../../src/db/index.js", () => {
  const schema = {
    locations: {
      id: "id",
      code: "code",
      area: "area",
      aisle: "aisle",
      rack: "rack",
      shelf: "shelf",
      spot: "spot",
      label: "label",
      createdAt: "createdAt",
    },
    productLocations: {
      id: "id",
      productId: "productId",
      locationId: "locationId",
      quantity: "quantity",
      createdAt: "createdAt",
    },
    productMovements: { id: "id" },
    productsCache: { id: "id" },
    config: { key: "key", value: "value", updatedAt: "updatedAt" },
  };
  return {
    getDb: () => activeDbMock,
    schema,
  };
});

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({ getPool: mockGetPool }),
}));

vi.mock("../../../src/api/idempotency.js", () => ({
  checkIdempotency: () => null,
  storeIdempotency: () => {},
}));

vi.mock("../../../src/lib/app-logger-server.js", () => ({
  logEvent: () => Promise.resolve(),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

function poolWith(val: string, subiektThrow = false) {
  return {
    request: () => {
      const builder: Record<string, unknown> = {};
      builder.input = vi.fn().mockReturnValue(builder);
      builder.query = async (sqlText: string) => {
        if (subiektThrow && /UPDATE tw__Towar/.test(sqlText)) {
          throw new Error("MSSQL down");
        }
        return { recordset: [{ val }] };
      };
      return builder;
    },
    query: async () => ({ recordset: [] }),
  };
}

describe("normalize (E3 dedup + E4 transactional)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    activeDbMock = buildDbMock();
    app = express();
    app.use(express.json());
    registerLocationsRoutes(app);
    app.use(errorHandler);
  });

  it("E4: wraps Postgres updates in db.transaction", async () => {
    mockGetPool.mockResolvedValue(poolWith(""));
    const res = await request(app)
      .post("/api/locations/normalize")
      .send({ productIds: [1, 2] });
    expect(res.status).toBe(200);
    expect(activeDbMock.transaction).toHaveBeenCalled();
  });

  it("E4: Subiekt-down is best-effort (returns 200, does NOT propagate error)", async () => {
    mockGetPool.mockResolvedValue(poolWith("", true));
    const res = await request(app)
      .post("/api/locations/normalize")
      .send({ productIds: [1] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 400 for missing productIds", async () => {
    const res = await request(app).post("/api/locations/normalize").send({});
    expect(res.status).toBe(400);
  });

  it("returns 503 when MSSQL pool is unavailable", async () => {
    mockGetPool.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/locations/normalize")
      .send({ productIds: [1] });
    expect(res.status).toBe(503);
  });
});
