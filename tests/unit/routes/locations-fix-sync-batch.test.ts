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
  selectResults: unknown[][];
  // Per-table pre-canned results for select: [first(), second(), ...]
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
        values: vi.fn().mockImplementation(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue([
            { id: "new-loc-id", code: "A 1-2-3-4", area: "A", aisle: 1, rack: 2, shelf: 3, spot: 4, label: "x" },
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
    transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      return cb({
        select: vi.fn().mockReturnValue(chain),
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
      });
    }),
    ops: [],
    selectResults: [],
  };
  return db;
}

function tagOf(t: unknown): string {
  const obj = t as Record<string, unknown> | null | undefined;
  if (!obj || typeof obj !== "object") return "unknown";
  if ("quantity" in obj && "locationId" in obj) return "product_locations";
  if ("fromLocationId" in obj) return "product_movements";
  if ("area" in obj && "code" in obj) return "locations";
  return "other";
}

let activeDbMock: MockDb;

vi.mock("../../../src/db/index.js", () => {
  const schema = {
    locations: { id: "id", code: "code", area: "area", aisle: "aisle", rack: "rack", shelf: "shelf", spot: "spot", label: "label", createdAt: "createdAt" },
    productLocations: { id: "id", productId: "productId", locationId: "locationId", quantity: "quantity", createdAt: "createdAt" },
    productMovements: { id: "id", productId: "productId", symbol: "symbol", name: "name", fromLocationId: "fromLocationId", toLocationId: "toLocationId", fromCode: "fromCode", toCode: "toCode", quantity: "quantity", operator: "operator", correlationId: "correlationId", createdAt: "createdAt", method: "method", actorSubiektUzId: "actorSubiektUzId" },
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

vi.mock("../../../src/lib/app-logger.js", () => ({
  logEvent: () => Promise.resolve(),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

function poolWith(val: string) {
  return {
    request: () => {
      const builder: Record<string, unknown> = {};
      builder.input = vi.fn().mockReturnValue(builder);
      builder.query = async () => ({ recordset: [{ val }] });
      return builder;
    },
    query: async () => ({ recordset: [] }),
  };
}

describe("fix-sync-batch subiekt-to-postgres (B3 diff-based merge)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    activeDbMock = buildDbMock();
    app = express();
    app.use(express.json());
    registerLocationsRoutes(app);
    app.use(errorHandler);
  });

  it("uses db.transaction (atomicity guarantee)", async () => {
    mockGetPool.mockResolvedValue(poolWith(""));
    const res = await request(app)
      .post("/api/locations/fix-sync-batch")
      .send({ productIds: [1], direction: "subiekt-to-postgres" });
    expect(res.status).toBe(200);
    expect(activeDbMock.transaction).toHaveBeenCalled();
  });

  it("does NOT bulk delete product_locations (replaces destructive delete with diff)", async () => {
    mockGetPool.mockResolvedValue(poolWith(""));
    const res = await request(app)
      .post("/api/locations/fix-sync-batch")
      .send({ productIds: [1], direction: "subiekt-to-postgres" });
    expect(res.status).toBe(200);
    // The OLD code did `db.delete(productLocations).where(eq(productLocations.productId, id))`
    // for ALL productIds unconditionally. The new code only deletes product_locations
    // whose code is no longer in Subiekt. Since Subiekt returns "" (no codes), no deletes
    // should happen at all.
    const deletes = activeDbMock.ops.filter((o) => o.kind === "delete" && o.table === "product_locations");
    expect(deletes).toHaveLength(0);
  });

  it("returns imported count and ok status on success", async () => {
    mockGetPool.mockResolvedValue(poolWith(""));
    const res = await request(app)
      .post("/api/locations/fix-sync-batch")
      .send({ productIds: [1, 2, 3], direction: "subiekt-to-postgres" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, imported: 0 });
  });
});
