import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

/**
 * Test weryfikuje, że requireAuthByDefault respektuje PUBLIC_PATHS,
 * w tym nowe endpointy dodane w Sprint 3 (chicken-and-egg fix):
 *   - /api/users
 *   - /api/warehouses
 *   - /api/erp-config
 *   - /api/test-connection
 *   - /api/wizard/clear
 *   - /api/wizard/import-all
 *
 * To jest test jednostkowy logiki middleware — nie potrzebuje bazy ani adaptera.
 */

vi.mock("../../src/db/index.js", () => ({
  getDb: vi.fn(),
  schema: { sessions: {}, users: {} },
}));

import { requireAuthByDefault } from "../../src/api/auth-middleware.js";

function makeReq(path: string, user?: { id: string; role: string }): Request {
  return { path, user } as unknown as Request;
}

function makeRes(): {
  res: Response;
  statusCode: number;
  body: unknown;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  return {
    res: { status, json } as unknown as Response,
    statusCode: 0,
    body: undefined,
    status,
    json,
  };
}

describe("requireAuthByDefault — PUBLIC_PATHS (Sprint 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Public paths (no auth required)", () => {
    it.each([
      "/api/login",
      "/api/health",
      "/api/wizard/status",
      "/ca",
      "/api/ca",
      // Nowe ścieżki dodane w Sprint 3
      "/api/users",
      "/api/warehouses",
      "/api/erp-config",
      "/api/test-connection",
      "/api/wizard/clear",
      "/api/wizard/import-all",
    ])("allows %s without req.user", (path) => {
      const req = makeReq(path);
      const { res, status, json } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      requireAuthByDefault(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(status).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });
  });

  describe("Protected paths (auth required)", () => {
    it("returns 401 'Zaloguj się' for /api/scan without user", () => {
      const req = makeReq("/api/scan");
      const { res, status, json } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      requireAuthByDefault(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(401);
      expect(json).toHaveBeenCalledWith({ error: "Zaloguj się" });
    });

    it("returns 401 for /api/locations without user", () => {
      const req = makeReq("/api/locations");
      const { res, status, json } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      requireAuthByDefault(req, res, next);
      expect(status).toHaveBeenCalledWith(401);
    });

    it("returns 401 for /api/products without user", () => {
      const req = makeReq("/api/products");
      const { res, status, json } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      requireAuthByDefault(req, res, next);
      expect(status).toHaveBeenCalledWith(401);
    });
  });

  describe("Path matching — only /api/* and /ca/* are protected", () => {
    it("does NOT protect /admin/login (frontend route)", () => {
      const req = makeReq("/admin/login");
      const { res } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      requireAuthByDefault(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("does NOT protect /static/* paths", () => {
      const req = makeReq("/static/main.js");
      const { res } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      requireAuthByDefault(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("With req.user set (logged in)", () => {
    it("calls next for any /api/* path when user is set", () => {
      const req = makeReq("/api/anything", { id: "u1", role: "admin" });
      const { res } = makeRes();
      const next = vi.fn() as unknown as NextFunction;
      requireAuthByDefault(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
