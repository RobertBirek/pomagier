import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerUsersRoutes } from "../../../src/api/routes/users.js";
import { errorHandler } from "../../../src/api/error-handler.js";

const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockResolvedValue([]),
  }),
};

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => mockDb,
  schema: { users: {} },
}));

describe("Users routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    registerUsersRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/users", () => {
    it("returns empty array when no pool", async () => {
      vi.doMock("../../../src/api/adapter-provider.js", () => ({
        getAdapter: () => ({ getPool: async () => null }),
      }));
      const res = await request(app).get("/api/users");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/warehouses", () => {
    it("returns empty array when no pool", async () => {
      vi.doMock("../../../src/api/adapter-provider.js", () => ({
        getAdapter: () => ({ getPool: async () => null }),
      }));
      const res = await request(app).get("/api/warehouses");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
