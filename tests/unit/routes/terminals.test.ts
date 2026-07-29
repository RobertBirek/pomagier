import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerTerminalsRoutes } from "../../../src/api/routes/terminals.js";
import { errorHandler } from "../../../src/api/error-handler.js";

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({
    getPool: () => null,
  }),
}));

vi.mock("drizzle-orm", () => ({
  sql: (...args: unknown[]) => String(args.join("")),
}));

vi.mock("../../../src/db/index.js", () => {
  const chain = {
    select: vi.fn(),
    from: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    where: vi.fn(),
    then: (resolve: (v: unknown) => void) => resolve([]),
  };
  chain.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.where.mockResolvedValue([]);

  return {
    getDb: () => chain,
    schema: {
      sessions: {
        id: "id",
        userId: "userId",
        createdAt: "createdAt",
        expiresAt: "expiresAt",
      },
      users: {
        id: "id",
        subiektUzId: "subiektUzId",
      },
    },
  };
});

vi.mock("../../../src/api/auth-middleware.js", () => ({
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

describe("Terminals routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    registerTerminalsRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/terminals", () => {
    it("returns an array of terminals", async () => {
      const res = await request(app).get("/api/terminals");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
