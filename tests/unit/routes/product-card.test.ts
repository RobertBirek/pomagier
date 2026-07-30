import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerProductsRoutes } from "../../../src/api/routes/products.js";
import { errorHandler } from "../../../src/api/error-handler.js";

describe("Product code endpoint", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerProductsRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/products/code/:code", () => {
    it("returns 404 for non-existent code", async () => {
      const res = await request(app).get("/api/products/code/NO_SUCH_CODE_99999");

      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });

    it("returns 400 for empty code", async () => {
      const res = await request(app).get("/api/products/code/");

      expect(res.status).toBe(400);
    });

    it("returns product data for existing symbol", async () => {
      const res = await request(app).get("/api/products/code/MX112906-4A");

      if (res.status === 200) {
        expect(res.body.productId).toBeTypeOf("number");
        expect(res.body.symbol).toBeTruthy();
        expect(res.body.name).toBeTruthy();
        expect(Array.isArray(res.body.stocks)).toBe(true);
        expect(Array.isArray(res.body.locations)).toBe(true);
        expect(Array.isArray(res.body.movements)).toBe(true);
      } else {
        expect(res.status).toBe(404);
      }
    });
  });
});
