import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerLocationsRoutes } from "../../../src/api/routes/locations.js";
import { errorHandler } from "../../../src/api/error-handler.js";

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuthByDefault: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../../src/db/index.js", () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    getDb: () => ({
      select: vi.fn().mockReturnValue(chain),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    }),
    schema: {
      locations: { id: "id", code: "code", area: "area", aisle: "aisle", rack: "rack", shelf: "shelf", spot: "spot", label: "label", createdAt: "createdAt" },
      productLocations: { id: "id", productId: "productId", locationId: "locationId", quantity: "quantity" },
      productMovements: { id: "id" },
      productsCache: { id: "id", symbol: "symbol", name: "name", barcode: "barcode", unit: "unit" },
    },
  };
});

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({ getPool: async () => null }),
}));

vi.mock("../../../src/api/idempotency.js", () => ({
  checkIdempotency: () => null,
  storeIdempotency: () => {},
}));

describe("Location card endpoint", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerLocationsRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/locations/:code", () => {
    it("returns 404 for non-existent location", async () => {
      const res = await request(app).get("/api/locations/X%2099-99-99-99");
      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });
  });
});
