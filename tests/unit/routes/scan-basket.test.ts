import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerScanRoutes } from "../../../src/api/routes/scan.js";
import { errorHandler } from "../../../src/api/error-handler.js";

describe("Scan-basket routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerScanRoutes(app);
    app.use(errorHandler);
  });

  describe("POST /api/scan-basket", () => {
    it("recognizes location code format", async () => {
      const res = await request(app).post("/api/scan-basket").send({ code: "A 1-2-3-4" });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("location");
      expect(res.body.code).toBe("A 1-2-3-4");
      expect(typeof res.body.productCount).toBe("number");
    });

    it("recognizes location code without space", async () => {
      const res = await request(app).post("/api/scan-basket").send({ code: "B5-2-1-1" });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("location");
      expect(res.body.code).toBe("B 5-2-1-1");
    });

    it("returns not_found for unknown product when DB unavailable", async () => {
      const res = await request(app).post("/api/scan-basket").send({ code: "NO_SUCH_PRODUCT_999" });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("not_found");
      expect(res.body.code).toBe("NO_SUCH_PRODUCT_999");
    });

    it("returns not_found for random EAN when DB unavailable", async () => {
      const res = await request(app).post("/api/scan-basket").send({ code: "1234567890123" });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("not_found");
    });

    it("returns 422 for code longer than 50 chars", async () => {
      const res = await request(app)
        .post("/api/scan-basket")
        .send({ code: "x".repeat(51) });

      expect(res.status).toBe(422);
      expect(res.body.error).toBeTruthy();
    });

    it("returns 422 for empty code", async () => {
      const res = await request(app).post("/api/scan-basket").send({ code: "" });

      expect(res.status).toBe(422);
      expect(res.body.error).toBeTruthy();
    });

    it("returns location for uppercase area letter", async () => {
      const res = await request(app).post("/api/scan-basket").send({ code: "C 3-1-2-1" });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("location");
      expect(res.body.code).toBe("C 3-1-2-1");
    });

    it("does NOT recognize invalid location format as location", async () => {
      const res = await request(app).post("/api/scan-basket").send({ code: "12-34-56" });

      expect(res.status).toBe(200);
      expect(res.body.type).toBe("not_found");
    });
  });
});
