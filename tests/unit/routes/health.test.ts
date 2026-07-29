import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerHealthRoutes } from "../../../src/api/routes/health.js";
import { errorHandler } from "../../../src/api/error-handler.js";
import { MockErpAdapter } from "../../../src/erp/mock.adapter.js";

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => new MockErpAdapter(),
}));

describe("Health routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerHealthRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/health", () => {
    it("returns ok status with timestamp", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeTruthy();
      expect(res.body.erp.ok).toBe(true);
    });
  });

  describe("GET /api/company", () => {
    it("returns demo data when no pool", async () => {
      const res = await request(app).get("/api/company");
      expect(res.status).toBe(200);
      expect(res.body.name).toBeTruthy();
    });
  });
});
