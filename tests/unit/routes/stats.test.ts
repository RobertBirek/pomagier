import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerStatsRoutes } from "../../../src/api/routes/stats.js";
import { errorHandler } from "../../../src/api/error-handler.js";

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

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
