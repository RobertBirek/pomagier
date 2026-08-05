import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerLocationsRoutes } from "../../../src/api/routes/locations.js";
import { errorHandler } from "../../../src/api/error-handler.js";

const { mockGetPool, mockCheckIdempotency, mockStoreIdempotency } = vi.hoisted(() => ({
  mockGetPool: vi.fn(),
  mockCheckIdempotency: vi.fn(() => null as { result: unknown; statusCode: number } | null),
  mockStoreIdempotency: vi.fn(),
}));

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
  selectResult: unknown[];
}

function buildDbMock(): MockDb {
  const db = {} as MockDb;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve([])),
    then: vi.fn().mockImplementation((resolve: (v: unknown[]) => void) => resolve(db.selectResult)),
  };
  Object.assign(db, {
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockImplementation((t: unknown) => {
      db.ops.push({ kind: "insert", table: tagOf(t) });
      return {
        values: vi.fn().mockImplementation(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue([
            {
              id: "loc-id",
              code: "A 1-2-3-4",
              area: "A",
              aisle: 1,
              rack: 2,
              shelf: 3,
              spot: 4,
              label: "x",
            },
          ]),
        })),
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
    transaction: vi
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(db)),
    ops: [],
    selectResult: [],
  });
  return db;
}

function tagOf(t: unknown): string {
  const obj = t as Record<string, unknown> | null | undefined;
  if (!obj || typeof obj !== "object") return "unknown";
  if ("quantity" in obj && "locationId" in obj) return "product_locations";
  if ("fromLocationId" in obj) return "product_movements";
  if ("area" in obj && "code" in obj) return "locations";
  if ("firstName" in obj) return "operators";
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
    productMovements: {
      id: "id",
      productId: "productId",
      symbol: "symbol",
      name: "name",
      fromLocationId: "fromLocationId",
      toLocationId: "toLocationId",
      fromCode: "fromCode",
      toCode: "toCode",
      quantity: "quantity",
      operator: "operator",
      correlationId: "correlationId",
      createdAt: "createdAt",
      method: "method",
      actorSubiektUzId: "actorSubiektUzId",
    },
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
  checkIdempotency: mockCheckIdempotency,
  storeIdempotency: mockStoreIdempotency,
}));

vi.mock("../../../src/lib/app-logger-server.js", () => ({
  logEvent: () => Promise.resolve(),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

function poolWith(subiektThrow: boolean, locationValue = "") {
  return {
    request: () => {
      const builder: Record<string, unknown> = {};
      builder.input = vi.fn().mockReturnValue(builder);
      builder.query = async (sqlText: string) => {
        if (subiektThrow && /UPDATE tw__Towar/.test(sqlText)) {
          throw new Error("MSSQL down");
        }
        if (
          /SELECT tw_Id AS id, tw_Symbol AS symbol, tw_Nazwa AS name FROM tw__Towar/.test(sqlText)
        ) {
          return { recordset: [{ id: 1, symbol: "TEST", name: "Test" }] };
        }
        if (/SELECT tw_Id AS id FROM tw__Towar/.test(sqlText)) {
          return { recordset: [{ id: 1 }] };
        }
        if (/SELECT \w+ AS val FROM tw__Towar/.test(sqlText)) {
          return { recordset: [{ val: locationValue }] };
        }
        if (/pd_Uzytkownik/.test(sqlText)) {
          return { recordset: [] };
        }
        if (/UPDATE tw__Towar/.test(sqlText)) {
          return { rowsAffected: [1] };
        }
        return { recordset: [] };
      };
      return builder;
    },
    query: async () => ({ recordset: [] }),
  };
}

describe("Locations dual-write compensation (B2)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckIdempotency.mockReturnValue(null);
    activeDbMock = buildDbMock();
    app = express();
    app.use(express.json());
    registerLocationsRoutes(app);
    app.use(errorHandler);
  });

  it("transfer Subiekt-down: compensation includes product_locations insert (rollback re-source)", async () => {
    mockGetPool.mockResolvedValue(poolWith(true));
    const res = await request(app)
      .post("/api/locations/transfer")
      .send({ codes: ["123"], fromLocation: "A 1-1-1-1", toLocation: "B 2-2-2-2" });
    expect(res.status).toBe(500);
    const inserts = activeDbMock.ops.filter(
      (o) => o.kind === "insert" && o.table === "product_locations",
    );
    expect(inserts.length).toBeGreaterThanOrEqual(1);
  });

  it("reset Subiekt-down: compensation includes product_locations insert (re-insert old rows)", async () => {
    mockGetPool.mockResolvedValue(poolWith(true));
    const res = await request(app)
      .post("/api/locations/reset")
      .send({ codes: ["123"], location: "A 1-1-1-1" });
    expect(res.status).toBe(500);
    const inserts = activeDbMock.ops.filter(
      (o) => o.kind === "insert" && o.table === "product_locations",
    );
    expect(inserts.length).toBeGreaterThanOrEqual(1);
    const deletes = activeDbMock.ops.filter(
      (o) => o.kind === "delete" && o.table === "product_locations",
    );
    expect(deletes.length).toBeGreaterThanOrEqual(1);
  });

  it("transfer Subiekt-down: does NOT log product_movements (rollback bails before log)", async () => {
    mockGetPool.mockResolvedValue(poolWith(true));
    const res = await request(app)
      .post("/api/locations/transfer")
      .send({ codes: ["123"], fromLocation: "A 1-1-1-1", toLocation: "B 2-2-2-2" });
    expect(res.status).toBe(500);
    const movementInserts = activeDbMock.ops.filter(
      (o) => o.kind === "insert" && o.table === "product_movements",
    );
    expect(movementInserts.length).toBe(0);
  });

  it("reset Subiekt-down: does NOT log product_movements (rollback bails before log)", async () => {
    mockGetPool.mockResolvedValue(poolWith(true));
    const res = await request(app)
      .post("/api/locations/reset")
      .send({ codes: ["123"], location: "A 1-1-1-1" });
    expect(res.status).toBe(500);
    const movementInserts = activeDbMock.ops.filter(
      (o) => o.kind === "insert" && o.table === "product_movements",
    );
    expect(movementInserts.length).toBe(0);
  });

  it("transfer Subiekt-down: does NOT throw SUBIEKT_FIELD_OVERFLOW when codes fit", async () => {
    mockGetPool.mockResolvedValue(poolWith(true));
    const res = await request(app)
      .post("/api/locations/transfer")
      .send({ codes: ["123"], fromLocation: "A 1-1-1-1", toLocation: "B 2-2-2-2" });
    expect(res.status).toBe(500);
    expect(res.body.error).not.toMatch(/nie mieszczą się/);
  });

  it("clear removes every product location and records a clearing movement", async () => {
    mockGetPool.mockResolvedValue(poolWith(false));
    activeDbMock.selectResult = [
      {
        productLocationId: "pl-1",
        productId: 1,
        locationId: "loc-1",
        code: "A 1-1-1-1",
        quantity: 2,
      },
    ];

    const res = await request(app)
      .post("/api/locations/clear")
      .send({ codes: ["123"] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, cleared: 1 });
    expect(activeDbMock.ops).toEqual(
      expect.arrayContaining([
        { kind: "delete", table: "product_locations" },
        { kind: "insert", table: "product_movements" },
      ]),
    );
  });

  it("clear restores product locations when Subiekt update fails", async () => {
    mockGetPool.mockResolvedValue(poolWith(true, "A 1-1-1-1"));
    activeDbMock.selectResult = [
      {
        productLocationId: "pl-1",
        productId: 1,
        locationId: "loc-1",
        code: "A 1-1-1-1",
        quantity: 1,
      },
    ];

    const res = await request(app)
      .post("/api/locations/clear")
      .send({ codes: ["123"] });

    expect(res.status).toBe(500);
    expect(activeDbMock.ops).not.toEqual(
      expect.arrayContaining([{ kind: "delete", table: "product_locations" }]),
    );
  });

  it("clear rejects non-string product codes", async () => {
    const res = await request(app)
      .post("/api/locations/clear")
      .send({ codes: [123] });

    expect(res.status).toBe(400);
  });

  it("clear reuses an idempotent response instead of executing again", async () => {
    mockCheckIdempotency.mockResolvedValueOnce({
      result: { ok: true, cleared: 1 },
      statusCode: 200,
    });

    const res = await request(app)
      .post("/api/locations/clear")
      .set("X-Idempotency-Key", "clear-operation-1")
      .send({ codes: ["123"] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, cleared: 1 });
    expect(mockGetPool).not.toHaveBeenCalled();
  });
});
