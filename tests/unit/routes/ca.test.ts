import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerCaRoutes } from "../../../src/api/routes/ca.js";
import { errorHandler } from "../../../src/api/error-handler.js";

vi.mock("node:fs", () => ({
  readFileSync: () => {
    throw new Error("ENOENT: no such file or directory");
  },
}));

describe("CA routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerCaRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /ca", () => {
    it("returns HTML download page", async () => {
      const res = await request(app).get("/ca");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Pobierz certyfikat");
      expect(res.headers["content-type"]).toContain("text/html");
    });
  });

  describe("GET /api/ca", () => {
    it("returns 404 when cert file not found", async () => {
      const res = await request(app).get("/api/ca");
      expect(res.status).toBe(404);
      expect(res.body.error).toBeTruthy();
    });
  });
});
