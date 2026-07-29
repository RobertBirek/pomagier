import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerErpConfigRoutes } from "../../../src/api/routes/erp-config.js";
import { errorHandler } from "../../../src/api/error-handler.js";

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({
    reconnect: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({ ok: true }),
  }),
}));

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    select: () => ({
      from: () => [],
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => Promise.resolve(),
      }),
    }),
  }),
  schema: {
    config: { key: "key", value: "value" },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe("ERP Config routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerErpConfigRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/erp-config", () => {
    it("returns config with password masked", async () => {
      const res = await request(app).get("/api/erp-config");
      expect(res.status).toBe(200);
      expect(res.body.password).toBe("\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022");
      expect(res.body).toHaveProperty("host");
      expect(res.body).toHaveProperty("database");
      expect(res.body).toHaveProperty("user");
    });
  });

  describe("POST /api/erp-config", () => {
    it("returns 422 when host is missing", async () => {
      const res = await request(app)
        .post("/api/erp-config")
        .send({ database: "test", user: "test" });
      expect(res.status).toBe(422);
      expect(res.body.error).toBeTruthy();
    });

    it("returns 422 when database is missing", async () => {
      const res = await request(app)
        .post("/api/erp-config")
        .send({ host: "localhost", user: "test" });
      expect(res.status).toBe(422);
    });

    it("returns 422 when user is missing", async () => {
      const res = await request(app)
        .post("/api/erp-config")
        .send({ host: "localhost", database: "test" });
      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/test-connection", () => {
    it("returns 422 when password is missing", async () => {
      const res = await request(app)
        .post("/api/test-connection")
        .send({ host: "localhost", database: "test", user: "test" });
      expect(res.status).toBe(422);
    });
  });
});
