import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerInventoryRoutes } from "../../../src/api/routes/inventory.js";
import { errorHandler } from "../../../src/api/error-handler.js";

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({
    getPool: () => null,
  }),
}));

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: () => ({
      values: () => Promise.resolve(),
    }),
  }),
  schema: {
    locations: { code: "code", area: "area", aisle: "aisle", rack: "rack", shelf: "shelf" },
    productLocations: {
      productId: "productId",
      locationId: "locationId",
      quantity: "quantity",
    },
    auditLog: { correlationId: "correlationId", action: "action", details: "details" },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe("Inventory routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerInventoryRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/inventory/expected", () => {
    it("returns products array", async () => {
      const res = await request(app).get("/api/inventory/expected");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("products");
      expect(Array.isArray(res.body.products)).toBe(true);
    });
  });

  describe("POST /api/inventory/report", () => {
    it("returns 400 when scanned is missing", async () => {
      const res = await request(app)
        .post("/api/inventory/report")
        .send({ scope: "exact", area: "A" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it("returns report summary when scanned is provided", async () => {
      const res = await request(app)
        .post("/api/inventory/report")
        .send({ scope: "exact", area: "A", scanned: [] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("summary");
    });
  });
});
