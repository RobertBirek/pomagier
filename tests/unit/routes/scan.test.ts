import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerScanRoutes } from "../../../src/api/routes/scan.js";
import { errorHandler } from "../../../src/api/error-handler.js";
import { MockErpAdapter } from "../../../src/erp/mock.adapter.js";

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => new MockErpAdapter(),
}));

// Mock resolveSupportedWarehouses to return a known list
vi.mock("../../../src/api/routes/erp-supported-warehouses.js", () => ({
  resolveSupportedWarehouses: async () => ({ ids: [1, 2], appliedDefault: false }),
}));

describe("Scan routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // After Sprint 4: warehouse comes from body, not from req.user
    app.use((req, _res, next) => {
      req.user = { id: "test-user", role: "operator", subiektUzId: 1 };
      next();
    });
    registerScanRoutes(app);
    app.use(errorHandler);
  });

  describe("POST /api/scan (operator)", () => {
    it("returns 200 + found=true with warehouse in body", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ code: "5901234567890", warehouse: 1 });

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.barcode).toBe("5901234567890");
      expect(res.body.products.length).toBeGreaterThan(0);
    });

    it("returns 200 + found=false with warehouse", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ code: "0000000000000", warehouse: 1 });

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(false);
      expect(res.body.barcode).toBe("0000000000000");
    });

    it("returns 400 when operator omits warehouse", async () => {
      const res = await request(app).post("/api/scan").send({ code: "5901234567890" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/magazyn/i);
    });

    it("returns 400 when operator sends unsupported warehouse", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ code: "5901234567890", warehouse: 999 });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/obsługiwany/i);
    });

    it("returns 422 for code longer than 50 chars", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ code: "x".repeat(51), warehouse: 1 });

      expect(res.status).toBe(422);
      expect(res.body.error).toBeTruthy();
    });

    it("returns 422 for empty code", async () => {
      const res = await request(app).post("/api/scan").send({ code: "", warehouse: 1 });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/scan (admin)", () => {
    beforeEach(() => {
      // Override auth to admin
      app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.user = { id: "admin", role: "admin", subiektUzId: 1 };
        next();
      });
      registerScanRoutes(app);
      app.use(errorHandler);
    });

    it("returns 200 for admin without warehouse (no filter)", async () => {
      const res = await request(app).post("/api/scan").send({ code: "5901234567890" });
      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
    });

    it("returns 200 for admin with warehouse", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ code: "5901234567890", warehouse: 1 });
      expect(res.status).toBe(200);
    });
  });
});
