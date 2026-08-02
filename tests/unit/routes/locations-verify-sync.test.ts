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

vi.mock("../../../src/api/idempotency.js", () => ({
  checkIdempotency: () => null,
  storeIdempotency: () => {},
}));

vi.mock("../../../src/lib/app-logger.js", () => ({
  logEvent: () => Promise.resolve(),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

function makeDb() {
  const selectResult: Record<string, unknown> = {};
  selectResult.from = vi.fn().mockReturnThis();
  selectResult.where = vi.fn().mockReturnThis();
  selectResult.innerJoin = vi.fn().mockReturnThis();
  selectResult.leftJoin = vi.fn().mockReturnThis();
  selectResult.groupBy = vi.fn().mockReturnThis();
  selectResult.orderBy = vi.fn().mockReturnThis();
  selectResult.limit = vi.fn().mockReturnThis();
  // Make await work by returning a thenable
  selectResult.then = (resolve: (v: unknown[]) => void) => {
    Promise.resolve([]).then(resolve);
  };
  return {
    select: vi.fn().mockReturnValue(selectResult),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({});
    }),
  };
}

let activeDbMock: ReturnType<typeof makeDb>;

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
    productsCache: { id: "id", symbol: "symbol", name: "name", barcode: "barcode", unit: "unit" },
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

function poolWith(results: { match: RegExp; result: unknown }[]) {
  return {
    request: () => {
      const builder: Record<string, unknown> = {};
      builder.input = vi.fn().mockReturnValue(builder);
      builder.query = async (sqlText: string) => {
        for (const r of results) {
          if (r.match.test(sqlText)) return r.result;
        }
        return { recordset: [] };
      };
      return builder;
    },
    query: async () => ({ recordset: [] }),
  };
}

describe("verify-sync endpoints (T3.3)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    activeDbMock = makeDb();
    app = express();
    app.use(express.json());
    registerLocationsRoutes(app);
    app.use(errorHandler);
  });

  it("GET /api/locations/verify-sync: returns 503 when MSSQL pool is unavailable", async () => {
    mockGetPool.mockResolvedValue(null);
    const res = await request(app).get("/api/locations/verify-sync");
    expect(res.status).toBe(503);
  });

  it("GET /api/locations/verify-sync: returns 200 with body when pool OK and no data", async () => {
    // Empty plRows + empty Subiekt result
    mockGetPool.mockResolvedValue(
      poolWith([{ match: /SELECT tw_Id AS id/, result: { recordset: [] } }]),
    );
    const res = await request(app).get("/api/locations/verify-sync");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalProducts: 0, mismatches: 0, synced: 0 });
  });

  it("GET /api/locations/verify-sync-detail: pagination parameters work", async () => {
    mockGetPool.mockResolvedValue(
      poolWith([{ match: /SELECT tw_Id AS id/, result: { recordset: [] } }]),
    );
    const res = await request(app).get("/api/locations/verify-sync-detail?page=2&pageSize=10");
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(10);
  });

  it("GET /api/locations/verify-sync-detail: returns 503 when MSSQL pool is unavailable", async () => {
    mockGetPool.mockResolvedValue(null);
    const res = await request(app).get("/api/locations/verify-sync-detail");
    expect(res.status).toBe(503);
  });

  it("GET /api/locations/verify-sync-detail: returns 200 with rows for Subiekt data", async () => {
    mockGetPool.mockResolvedValue(
      poolWith([
        { match: /SELECT tw_Id AS id/, result: { recordset: [{ id: 1, val: "A 1-2-3-4" }] } },
        { match: /FROM tw__Towar WHERE tw_Id IN/, result: { recordset: [] } },
      ]),
    );
    const res = await request(app).get("/api/locations/verify-sync-detail?status=mismatch");
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0]).toMatchObject({ productId: 1 });
  });

  it("GET /api/locations/verify-sync-detail: filters by area (case sensitive)", async () => {
    mockGetPool.mockResolvedValue(
      poolWith([
        { match: /SELECT tw_Id AS id/, result: { recordset: [{ id: 1, val: "A 1-2-3-4" }] } },
        { match: /FROM tw__Towar WHERE tw_Id IN/, result: { recordset: [] } },
      ]),
    );
    const res = await request(app).get("/api/locations/verify-sync-detail?area=A");
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });

  it("GET /api/locations/verify-sync-detail: status=synced returns 200 (empty when all mismatch)", async () => {
    mockGetPool.mockResolvedValue(
      poolWith([
        { match: /SELECT tw_Id AS id/, result: { recordset: [{ id: 1, val: "A 1-2-3-4" }] } },
        { match: /FROM tw__Towar WHERE tw_Id IN/, result: { recordset: [] } },
      ]),
    );
    const res = await request(app).get("/api/locations/verify-sync-detail?status=synced");
    expect(res.status).toBe(200);
    // No Postgres data means allRows is empty, so synced returns 0
    expect(res.body.rows).toHaveLength(0);
  });
});
