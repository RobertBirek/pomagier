import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  registerErpSupportedWarehousesRoutes,
  _resetCacheForTests,
} from "../../../src/api/routes/erp-supported-warehouses.js";
import { errorHandler } from "../../../src/api/error-handler.js";

const mockPool = {
  request: vi.fn().mockReturnValue({
    query: vi.fn().mockResolvedValue({
      recordset: [
        { id: 1, symbol: "MAG", name: "Główny", isMain: true },
        { id: 3, symbol: "AZZ", name: "Azzardo", isMain: false },
        { id: 4, symbol: "EIL", name: "Ekspozycja", isMain: false },
      ],
    }),
    input: vi.fn().mockReturnThis(),
  }),
};

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({
    getPool: async () => mockPool,
  }),
}));

const mockDbState: { config: Record<string, string> } = { config: {} };

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (_cond: unknown) => {
          // In tests we control state via mockDbState; eq is mocked as vi.fn() returning undefined.
          // The route's query is `SELECT * FROM config WHERE key = "supported_warehouses"`.
          // We pre-set the only key the route ever reads.
          const v = mockDbState.config.supported_warehouses;
          return Promise.resolve(v ? [{ key: "supported_warehouses", value: v }] : []);
        },
      }),
    }),
    insert: (table: { _: { name: string } }) => ({
      values: (values: { key: string; value: string }) => {
        mockDbState.config[values.key] = values.value;
        return {
          onConflictDoUpdate: () => Promise.resolve(),
          onConflictDoNothing: () => Promise.resolve(),
        };
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: () => Promise.resolve() }),
  }),
  schema: { config: { key: "key", value: "value" } },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe("ERP supported warehouses (Sprint 4)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbState.config = {};
    _resetCacheForTests();
    app = express();
    app.use(express.json());
    registerErpSupportedWarehousesRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/erp/supported-warehouses", () => {
    it("returns all warehouses and empty supportedIds when config empty", async () => {
      const res = await request(app).get("/api/erp/supported-warehouses");
      expect(res.status).toBe(200);
      expect(res.body.all).toHaveLength(3);
      expect(res.body.supportedIds).toEqual([]);
      expect(res.body.configured).toBe(false);
    });

    it("returns all warehouses and configured supportedIds", async () => {
      mockDbState.config.supported_warehouses = JSON.stringify([1, 3]);
      const res = await request(app).get("/api/erp/supported-warehouses");
      expect(res.status).toBe(200);
      expect(res.body.supportedIds).toEqual([1, 3]);
      expect(res.body.configured).toBe(true);
    });
  });

  describe("PUT /api/erp/supported-warehouses", () => {
    it("saves valid warehouse list", async () => {
      const res = await request(app)
        .put("/api/erp/supported-warehouses")
        .send({ warehouseIds: [1, 3, 4] });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.supportedIds).toEqual([1, 3, 4]);
      // Verify persisted
      expect(mockDbState.config.supported_warehouses).toBe(JSON.stringify([1, 3, 4]));
    });

    it("accepts empty list (disable all)", async () => {
      const res = await request(app)
        .put("/api/erp/supported-warehouses")
        .send({ warehouseIds: [] });
      expect(res.status).toBe(200);
      expect(res.body.supportedIds).toEqual([]);
    });

    it("rejects warehouse IDs not in Subiekt", async () => {
      const res = await request(app)
        .put("/api/erp/supported-warehouses")
        .send({ warehouseIds: [1, 999] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/999/);
    });

    it("returns 422 for invalid body", async () => {
      const res = await request(app)
        .put("/api/erp/supported-warehouses")
        .send({ warehouseIds: "not_an_array" });
      expect(res.status).toBe(422);
    });
  });
});
