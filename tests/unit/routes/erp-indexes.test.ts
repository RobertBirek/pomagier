import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../../src/api/error-handler.js";
import { registerErpIndexesRoutes } from "../../../src/api/routes/erp-indexes.js";

const query = vi.fn();
const pool = { request: () => ({ query }) };

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({ getPool: async () => pool }),
}));
vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    insert: () => ({ values: () => Promise.resolve() }),
  }),
  schema: { auditLog: {} },
}));

describe("ERP indexes routes", () => {
  it("reports missing indexes without changing the database", async () => {
    query.mockResolvedValueOnce({ recordset: [{ name: "IX_pomagier_tw_Towar_Symbol" }] });
    const app = express();
    app.use(express.json());
    registerErpIndexesRoutes(app);
    app.use(errorHandler);

    const response = await request(app).get("/api/erp-indexes");

    expect(response.status).toBe(200);
    expect(response.body.missing).toContain("IX_pomagier_tw_Towar_KodKresk");
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("creates only missing indexes after explicit confirmation", async () => {
    query.mockReset();
    query.mockResolvedValueOnce({ recordset: [] });
    query.mockResolvedValue({ recordset: [] });
    const app = express();
    app.use(express.json());
    registerErpIndexesRoutes(app);
    app.use(errorHandler);

    const response = await request(app)
      .post("/api/erp-indexes/apply")
      .send({ confirmation: "UTWÓRZ INDEKSY" });

    expect(response.status).toBe(200);
    expect(response.body.created).toHaveLength(3);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("rejects apply without explicit confirmation", async () => {
    const app = express();
    app.use(express.json());
    registerErpIndexesRoutes(app);
    app.use(errorHandler);

    const response = await request(app)
      .post("/api/erp-indexes/apply")
      .send({ confirmation: "TAK" });

    expect(response.status).toBe(422);
  });
});
