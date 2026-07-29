import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerFieldMappingsRoutes } from "../../../src/api/routes/field-mappings.js";
import { errorHandler } from "../../../src/api/error-handler.js";

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({}),
}));

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    select: () => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
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

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../../src/lib/field-mappings.js", () => ({
  DEFAULT_MAPPINGS: [
    { key: "location", label: "Lokalizacja", subiektField: "tw_Pole1" },
    { key: "batch", label: "Partia", subiektField: "tw_Pole2" },
  ],
}));

describe("Field Mappings routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerFieldMappingsRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/field-mappings", () => {
    it("returns mapping array", async () => {
      const res = await request(app).get("/api/field-mappings");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("key");
      expect(res.body[0]).toHaveProperty("subiektField");
    });
  });

  describe("PUT /api/field-mappings", () => {
    it("returns 422 when body is not an array", async () => {
      const res = await request(app).put("/api/field-mappings").send({ notMappings: {} });
      expect(res.status).toBe(422);
    });

    it("returns 422 when array items missing key", async () => {
      const res = await request(app)
        .put("/api/field-mappings")
        .send([{ subiektField: "tw_Pole1" }]);
      expect(res.status).toBe(422);
    });
  });
});
