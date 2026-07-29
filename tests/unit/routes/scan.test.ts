import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerScanRoutes } from "../../../src/api/routes/scan.js";
import { errorHandler } from "../../../src/api/error-handler.js";
import { MockErpAdapter } from "../../../src/erp/mock.adapter.js";

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => new MockErpAdapter(),
}));

describe("Scan routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerScanRoutes(app);
    app.use(errorHandler);
  });

  describe("POST /api/scan", () => {
    it("returns found=true for known barcode", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ code: "5901234567890" });

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.barcode).toBe("5901234567890");
      expect(res.body.products.length).toBeGreaterThan(0);
    });

    it("returns found=false for unknown barcode", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ code: "0000000000000" });

      expect(res.status).toBe(200);
      expect(res.body.found).toBe(false);
      expect(res.body.barcode).toBe("0000000000000");
      expect(res.body.products.length).toBe(0);
    });

    it("returns 422 for code longer than 50 chars", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ code: "x".repeat(51) });

      expect(res.status).toBe(422);
      expect(res.body.error).toBeTruthy();
    });

    it("returns 422 for empty code", async () => {
      const res = await request(app)
        .post("/api/scan")
        .send({ code: "" });

      expect(res.status).toBe(422);
      expect(res.body.error).toBeTruthy();
    });
  });
});
