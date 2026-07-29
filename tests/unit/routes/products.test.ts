import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerProductsRoutes } from "../../../src/api/routes/products.js";
import { errorHandler } from "../../../src/api/error-handler.js";

const mockGetPool = vi.fn();

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({ getPool: mockGetPool }),
}));

function mockEmptyPool() {
  return {
    request: () => ({
      input: () => ({
        query: async () => ({ recordset: [] }),
      }),
      query: async () => ({ recordset: [] }),
    }),
  };
}

describe("Products routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    registerProductsRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/products (paginated)", () => {
    it("returns empty rows when no pool", async () => {
      mockGetPool.mockResolvedValue(null);
      const res = await request(app).get("/api/products");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ rows: [], total: 0, page: 1, pageSize: 50 });
    });
  });

  describe("GET /api/products/:id (detail)", () => {
    it("returns 404 when product not found", async () => {
      mockGetPool.mockResolvedValue(mockEmptyPool());
      const res = await request(app).get("/api/products/999");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Nie znaleziono");
    });
  });

  describe("GET /api/products/random", () => {
    it("returns demo fallback when no pool", async () => {
      mockGetPool.mockResolvedValue(null);
      const res = await request(app).get("/api/products/random");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ code: "5901234567890", name: "Demo" });
    });
  });

  describe("GET /api/products/quick-search", () => {
    it("returns empty array when query is less than 2 chars", async () => {
      const res = await request(app).get("/api/products/quick-search?q=a");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
