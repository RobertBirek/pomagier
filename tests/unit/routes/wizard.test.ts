import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerWizardRoutes } from "../../../src/api/routes/wizard.js";
import { errorHandler } from "../../../src/api/error-handler.js";

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({
    getPool: () => null,
  }),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("../../../src/api/routes/locations.js", () => ({
  getLocationField: vi.fn().mockResolvedValue("tw_Pole1"),
}));

vi.mock("../../../src/db/index.js", () => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue([{ value: "localhost" }]);
  chain.insert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    }),
  });
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: any) => void) => resolve([]);

  return {
    getDb: () => chain,
    schema: {
      config: { key: "key", value: "value" },
      locations: {
        code: "code",
        area: "area",
        aisle: "aisle",
        rack: "rack",
        shelf: "shelf",
        spot: "spot",
        label: "label",
      },
      productLocations: {
        productId: "productId",
        locationId: "locationId",
        quantity: "quantity",
      },
      productMovements: {},
      users: {
        subiektUzId: "subiektUzId",
        pin: "pin",
        role: "role",
      },
    },
  };
});

vi.mock("../../../src/lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

describe("Wizard routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerWizardRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/wizard/status", () => {
    it("returns configured status", async () => {
      const res = await request(app).get("/api/wizard/status");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("configured");
      expect(res.body).toHaveProperty("hasEnv");
    });
  });

  describe("POST /api/wizard/clear", () => {
    it("returns 400 when tables is not an array", async () => {
      const res = await request(app)
        .post("/api/wizard/clear")
        .send({ tables: "not_an_array" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });

    it("clears specified tables and returns ok", async () => {
      const res = await request(app)
        .post("/api/wizard/clear")
        .send({ tables: ["locations"] });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe("POST /api/wizard/import-all", () => {
    it("returns 503 when MSSQL not available", async () => {
      const res = await request(app)
        .post("/api/wizard/import-all");
      expect(res.status).toBe(503);
      expect(res.body.error).toBeTruthy();
    });
  });
});
