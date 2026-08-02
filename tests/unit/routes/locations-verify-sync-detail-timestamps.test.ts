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

type DbMock = ReturnType<typeof makeDb>;
let activeDbMock: DbMock;
function getMock(): DbMock {
  return activeDbMock;
}

function makeDb() {
  const freshChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn().mockReturnThis();
    chain.innerJoin = vi.fn().mockReturnThis();
    chain.leftJoin = vi.fn().mockReturnThis();
    chain.groupBy = vi.fn().mockReturnThis();
    chain.orderBy = vi.fn().mockReturnThis();
    chain.limit = vi.fn().mockReturnThis();
    // Make the chain thenable (any `await` on it resolves to [] by default)
    chain.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve);
    return chain;
  };

  let whereQueue: Array<() => Promise<unknown>> = [];

  const select = vi.fn().mockImplementation(() => {
    const chain = freshChain();
    chain.where = vi.fn().mockImplementation(() => {
      const handler =
        whereQueue.length > 0 ? whereQueue.shift()! : () => Promise.resolve([]);
      const p = handler();
      const thenable: Record<string, unknown> = {};
      thenable.then = (resolve: (v: unknown) => void) => p.then(resolve);
      return thenable;
    });
    return chain;
  });

  return {
    select,
    setWhereResults: (results: Array<() => Promise<unknown>>) => {
      whereQueue = [...results];
    },
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

describe("verify-sync-detail enhanced with subiektModifiedAt (T4.3)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    activeDbMock = makeDb();
    app = express();
    app.use(express.json());
    registerLocationsRoutes(app);
    app.use(errorHandler);
  });

  it("returns rows with subiektModifiedAt from MSSQL", async () => {
    const modifiedAt = new Date("2026-08-01T12:00:00Z");
    mockGetPool.mockResolvedValue(
      poolWith([
        { match: /tw_CzasM AS modifiedAt/, result: { recordset: [{ id: 1, val: "A 1-2-3-4", modifiedAt }] } },
        { match: /FROM tw__Towar WHERE tw_Id IN/, result: { recordset: [] } },
      ]),
    );
    getMock().setWhereResults([
      () => Promise.resolve([]),
      () => Promise.resolve([]),
      () => Promise.resolve([]),
    ]);
    const res = await request(app).get("/api/locations/verify-sync-detail?status=mismatch");
    expect(res.status).toBe(200);
    expect(res.body.rows[0].subiektModifiedAt).toBeDefined();
  });

  it("includes lastSyncAt at top level when subiekt_last_sync_at is in config", async () => {
    activeDbMock = makeDb();
    mockGetPool.mockResolvedValue(
      poolWith([{ match: /tw_CzasM AS modifiedAt/, result: { recordset: [] } }]),
    );
    // Subiekt is empty so productsCache is skipped — only 2 where calls
    getMock().setWhereResults([
      () => Promise.resolve([]),
      () => Promise.resolve([{ value: "2026-07-15T08:00:00.000Z" }]),
    ]);
    const res = await request(app).get("/api/locations/verify-sync-detail");
    expect(res.status).toBe(200);
    expect(res.body.lastSyncAt).toBe("2026-07-15T08:00:00.000Z");
  });

  it("returns lastSyncAt as null when no config row exists", async () => {
    activeDbMock = makeDb();
    mockGetPool.mockResolvedValue(
      poolWith([{ match: /tw_CzasM AS modifiedAt/, result: { recordset: [] } }]),
    );
    getMock().setWhereResults([() => Promise.resolve([]), () => Promise.resolve([])]);
    const res = await request(app).get("/api/locations/verify-sync-detail");
    expect(res.status).toBe(200);
    expect(res.body.lastSyncAt).toBeNull();
  });
});
