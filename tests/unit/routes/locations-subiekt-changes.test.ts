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

vi.mock("../../../src/lib/app-logger-server.js", () => ({
  logEvent: () => Promise.resolve(),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

function makeDb(opts: { lastSyncRow?: { value: string } | null } = {}) {
  const selectResult: Record<string, unknown> = {};
  selectResult.from = vi.fn().mockReturnThis();
  selectResult.where = vi.fn().mockReturnThis();
  selectResult.innerJoin = vi.fn().mockReturnThis();
  selectResult.leftJoin = vi.fn().mockReturnThis();
  selectResult.groupBy = vi.fn().mockReturnThis();
  selectResult.orderBy = vi.fn().mockReturnThis();
  selectResult.limit = vi.fn().mockReturnThis();

  let whereCallIndex = 0;
  selectResult.where = vi.fn().mockImplementation(() => {
    whereCallIndex++;
    // First where: getLocationField reads config for locationField (default)
    // Second where: subiekt-changes reads config for subiekt_last_sync_at
    const isLocationFieldCall = whereCallIndex === 1;
    const row = isLocationFieldCall ? undefined : opts.lastSyncRow;
    const chain: Record<string, unknown> = {};
    const p = Promise.resolve(row ? [row] : []);
    chain.then = (resolve: (v: unknown) => void) => p.then(resolve);
    return chain;
  });

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
    locations: { id: "id", code: "code" },
    productLocations: { id: "id", productId: "productId", locationId: "locationId" },
    productMovements: { id: "id" },
    productsCache: { id: "id", symbol: "symbol", name: "name" },
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

describe("GET /api/locations/subiekt-changes (T4.1)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    activeDbMock = makeDb();
    app = express();
    app.use(express.json());
    registerLocationsRoutes(app);
    app.use(errorHandler);
  });

  it("returns 503 when MSSQL pool is unavailable", async () => {
    mockGetPool.mockResolvedValue(null);
    const res = await request(app).get("/api/locations/subiekt-changes");
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/MSSQL/);
  });

  it("returns 200 with empty products when no changes since timestamp", async () => {
    mockGetPool.mockResolvedValue(poolWith([{ match: /tw_CzasM/, result: { recordset: [] } }]));
    const res = await request(app).get("/api/locations/subiekt-changes");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 0, products: [] });
    expect(res.body.since).toBeDefined();
    expect(res.body.newSince).toBeDefined();
  });

  it("returns modified products with parsed location codes", async () => {
    mockGetPool.mockResolvedValue(
      poolWith([
        {
          match: /tw_CzasM/,
          result: {
            recordset: [
              {
                id: 42,
                symbol: "PROD-1",
                name: "Test Product",
                val: "A 1-2-3-4, B 5-6-7-8",
                modifiedAt: new Date("2026-08-01T12:00:00Z"),
              },
            ],
          },
        },
      ]),
    );
    const res = await request(app).get("/api/locations/subiekt-changes");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0]).toMatchObject({
      productId: 42,
      symbol: "PROD-1",
      name: "Test Product",
      subiektCodes: ["A 1-2-3-4", "B 5-6-7-8"],
    });
    expect(res.body.newSince).toBeDefined();
  });

  it("accepts ?since=ISO query parameter", async () => {
    mockGetPool.mockResolvedValue(poolWith([{ match: /tw_CzasM/, result: { recordset: [] } }]));
    const since = "2026-07-01T00:00:00.000Z";
    const res = await request(app).get(
      `/api/locations/subiekt-changes?since=${encodeURIComponent(since)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.since).toBe(since);
  });

  it("uses last_sync_at from config when ?since is missing", async () => {
    activeDbMock = makeDb({ lastSyncRow: { value: "2026-06-15T10:00:00.000Z" } });
    mockGetPool.mockResolvedValue(poolWith([{ match: /tw_CzasM/, result: { recordset: [] } }]));
    const res = await request(app).get("/api/locations/subiekt-changes");
    expect(res.status).toBe(200);
    expect(res.body.since).toBe("2026-06-15T10:00:00.000Z");
  });

  it("filters out NULL/empty location values via NULLIF in SQL (returns 200 with empty when none match)", async () => {
    mockGetPool.mockResolvedValue(poolWith([{ match: /tw_CzasM/, result: { recordset: [] } }]));
    const res = await request(app).get("/api/locations/subiekt-changes");
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });

  it("handles single code (no separator) correctly", async () => {
    mockGetPool.mockResolvedValue(
      poolWith([
        {
          match: /tw_CzasM/,
          result: {
            recordset: [
              {
                id: 7,
                symbol: "X",
                name: "Solo",
                val: "C 9-9-9-9",
                modifiedAt: new Date(),
              },
            ],
          },
        },
      ]),
    );
    const res = await request(app).get("/api/locations/subiekt-changes");
    expect(res.body.products[0].subiektCodes).toEqual(["C 9-9-9-9"]);
  });

  it("returns 500 on internal error", async () => {
    mockGetPool.mockRejectedValue(new Error("DB boom"));
    const res = await request(app).get("/api/locations/subiekt-changes");
    expect(res.status).toBe(500);
  });
});
