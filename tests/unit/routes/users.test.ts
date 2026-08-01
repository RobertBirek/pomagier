import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerUsersRoutes } from "../../../src/api/routes/users.js";
import { errorHandler } from "../../../src/api/error-handler.js";

// Mock supported-warehouses so /api/warehouses can apply filter
vi.mock("../../../src/api/routes/erp-supported-warehouses.js", () => ({
  resolveSupportedWarehouses: vi.fn().mockResolvedValue({ ids: [1, 2], appliedDefault: false }),
  fetchAllWarehouses: vi.fn().mockResolvedValue([
    { id: 1, symbol: "MAG", name: "Główny", isMain: true },
    { id: 2, symbol: "MAP", name: "Pomocniczy", isMain: false },
    { id: 3, symbol: "RKR", name: "Krosno", isMain: false },
  ]),
}));

const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockResolvedValue([]),
  }),
};

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => mockDb,
  schema: { users: {} },
}));

describe("Users routes (Sprint 4 — no warehouseId per user)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    registerUsersRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/users", () => {
    it("returns array of users WITHOUT warehouseId field", async () => {
      vi.doMock("../../../src/api/adapter-provider.js", () => ({
        getAdapter: () => ({
          getPool: async () => ({
            request: () => ({
              query: vi.fn().mockResolvedValue({
                recordset: [{ id: 1, firstName: "Jan", lastName: "Kowalski", active: true }],
              }),
              input: vi.fn().mockReturnThis(),
            }),
          }),
        }),
      }));
      const res = await request(app).get("/api/users");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // CRITICAL: no warehouseId field per user (Sprint 4)
      if (res.body.length > 0) {
        expect(res.body[0]).not.toHaveProperty("warehouseId");
      }
    });
  });

  describe("GET /api/warehouses", () => {
    it("returns only supported warehouses (filtered by supported_warehouses)", async () => {
      vi.doMock("../../../src/api/adapter-provider.js", () => ({
        getAdapter: () => ({
          getPool: async () => ({
            request: () => ({
              query: vi.fn().mockResolvedValue({
                recordset: [
                  { id: 1, symbol: "MAG", name: "Główny", isMain: true },
                  { id: 2, symbol: "MAP", name: "Pomocniczy", isMain: false },
                  { id: 3, symbol: "RKR", name: "Krosno", isMain: false },
                ],
              }),
              input: vi.fn().mockReturnThis(),
            }),
          }),
        }),
      }));
      const res = await request(app).get("/api/warehouses");
      expect(res.status).toBe(200);
      // resolveSupportedWarehouses returns [1, 2] → only those
      expect(res.body).toHaveLength(2);
      expect(res.body.map((w: { id: number }) => w.id)).toEqual([1, 2]);
    });
  });

  describe("PUT /api/users/:subiektId/warehouse", () => {
    it("returns 404 (endpoint removed in Sprint 4)", async () => {
      const res = await request(app).put("/api/users/1/warehouse").send({ warehouseId: 1 });
      expect(res.status).toBe(404);
    });
  });
});
