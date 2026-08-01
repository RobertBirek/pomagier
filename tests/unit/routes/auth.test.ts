import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerAuthRoutes } from "../../../src/api/routes/auth.js";
import { errorHandler } from "../../../src/api/error-handler.js";
import bcrypt from "bcryptjs";

// Mock db
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  }),
  delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
};

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => mockDb,
  schema: {
    users: {},
    sessions: {},
    auditLog: {},
    loginAttempts: { subiektUzId: "subiektUzId" },
  },
}));

// Mock adapter
const mockPool = { request: vi.fn().mockReturnValue({ query: vi.fn() }) };
vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({
    getPool: async () => mockPool,
    healthCheck: async () => ({ ok: true, latencyMs: 1 }),
  }),
}));

describe("Auth routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(express.json({ limit: "1mb" }));
    registerAuthRoutes(app);
    app.use(errorHandler);
  });

  describe("POST /api/login", () => {
    it("returns identity without exposing the session token in JSON", async () => {
      const user = {
        id: "user-1",
        subiektUzId: 1,
        pin: bcrypt.hashSync("1234", 4),
        role: "admin",
        active: true,
      };
      const chain = (rows: unknown[]) => ({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }),
      });
      mockDb.select.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([user]));
      const res = await request(app).post("/api/login").send({ subiektUzId: 1, pin: "1234" });
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: "user-1", subiektUzId: 1, role: "admin" });
      expect(res.body).not.toHaveProperty("token");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("returns 422 for missing body", async () => {
      const res = await request(app).post("/api/login").send({});
      expect(res.status).toBe(422);
    });

    it("returns 422 for invalid subiektUzId", async () => {
      const res = await request(app).post("/api/login").send({ subiektUzId: -1, pin: "1234" });
      expect(res.status).toBe(422);
    });

    it("returns 422 for pin too short", async () => {
      const res = await request(app).post("/api/login").send({ subiektUzId: 1, pin: "12" });
      expect(res.status).toBe(422);
    });

    it("returns 401 for non-existent user", async () => {
      const res = await request(app).post("/api/login").send({ subiektUzId: 1, pin: "1234" });
      expect(res.status).toBe(401);
    });

    it("writes a login event via logEvent on successful login", async () => {
      const user = {
        id: "user-1",
        subiektUzId: 1,
        pin: bcrypt.hashSync("1234", 4),
        role: "admin",
        active: true,
      };
      const chain = (rows: unknown[]) => ({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }),
      });
      mockDb.select.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([user]));
      await request(app).post("/api/login").send({ subiektUzId: 1, pin: "1234" });
      // 2 inserts expected on success: sessions + logEvent auditLog
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it("writes a login_failed event via logEvent when user not found", async () => {
      await request(app).post("/api/login").send({ subiektUzId: 1, pin: "1234" });
      // 2 inserts expected: loginAttempts (recordPinFailure) + logEvent
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe("PUT /api/users/:subiektId/pin", () => {
    it("returns 422 for non-numeric pin", async () => {
      const res = await request(app).put("/api/users/1/pin").send({ pin: "abcd" });
      expect(res.status).toBe(422);
    });
  });

  describe("PUT /api/users/:subiektId/role", () => {
    it("returns 422 for invalid role", async () => {
      const res = await request(app).put("/api/users/1/role").send({ role: "superadmin" });
      expect(res.status).toBe(422);
    });
  });
});
