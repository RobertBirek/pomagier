import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerActivityRoutes } from "../../../src/api/routes/activity.js";
import { errorHandler } from "../../../src/api/error-handler.js";

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({}),
}));

vi.mock("drizzle-orm", () => ({
  sql: (...args: any[]) => args.join(""),
}));

vi.mock("../../../src/db/index.js", () => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockResolvedValue([]);
  chain.where = vi.fn().mockResolvedValue([{ count: 5 }]);
  chain.then = (resolve: (v: any) => void) => resolve([]);

  return {
    getDb: () => chain,
    schema: {
      productMovements: {
        id: "id",
        createdAt: "createdAt",
        productId: "productId",
        symbol: "symbol",
        name: "name",
        fromCode: "fromCode",
        toCode: "toCode",
        quantity: "quantity",
        operator: "operator",
        correlationId: "correlationId",
      },
      auditLog: {
        id: "id",
        createdAt: "createdAt",
        action: "action",
        details: "details",
        correlationId: "correlationId",
        userId: "userId",
      },
    },
  };
});

describe("Activity routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerActivityRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/activity", () => {
    it("returns activity data with movements and dailyStats", async () => {
      const res = await request(app).get("/api/activity");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("movements");
      expect(res.body).toHaveProperty("dailyStats");
      expect(Array.isArray(res.body.movements)).toBe(true);
      expect(Array.isArray(res.body.dailyStats)).toBe(true);
    });
  });

  describe("GET /api/logs", () => {
    it("returns paginated logs", async () => {
      const res = await request(app).get("/api/logs");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("rows");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("page");
      expect(res.body).toHaveProperty("pageSize");
      expect(Array.isArray(res.body.rows)).toBe(true);
    });

    it("accepts page and pageSize query params", async () => {
      const res = await request(app).get("/api/logs?page=2&pageSize=25");
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
      expect(res.body.pageSize).toBe(25);
    });
  });
});
