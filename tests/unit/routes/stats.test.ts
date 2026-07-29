import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerStatsRoutes } from "../../../src/api/routes/stats.js";
import { errorHandler } from "../../../src/api/error-handler.js";

describe("Stats routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    registerStatsRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/stats", () => {
    it("returns zero stats when no pool", async () => {
      vi.doMock("../../../src/api/adapter-provider.js", () => ({
        getAdapter: () => ({ getPool: async () => null }),
      }));
      const res = await request(app).get("/api/stats");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ products: 0, warehouses: 0, users: 0 });
    });
  });
});
