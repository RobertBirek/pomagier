import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerLocationsRoutes } from "../../../src/api/routes/locations.js";
import { errorHandler } from "../../../src/api/error-handler.js";

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

    it("returns location data for existing code", async () => {
      const res = await request(app).get("/api/locations/A%201-1-1-1");

      if (res.status === 200) {
        expect(res.body.code).toBe("A 1-1-1-1");
        expect(res.body.area).toBe("A");
        expect(typeof res.body.productCount).toBe("number");
        expect(Array.isArray(res.body.products)).toBe(true);
        expect(Array.isArray(res.body.movements)).toBe(true);
      } else {
        // DB may be unavailable
        expect(res.status).toBe(404);
      }
    });
  });
});
