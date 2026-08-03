import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { registerHealthRoutes } from "../../../src/api/routes/health.js";
import { errorHandler } from "../../../src/api/error-handler.js";
import { logEvent } from "../../../src/lib/app-logger-server.js";

vi.mock("../../../src/lib/app-logger-server.js", () => ({
  logEvent: vi.fn(() => Promise.resolve()),
}));

const logEventMock = vi.mocked(logEvent);

describe("Health routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    registerHealthRoutes(app);
    app.use(errorHandler);
  });

  describe("GET /api/health", () => {
    it("returns ok status with timestamp", async () => {
      vi.doMock("../../../src/api/adapter-provider.js", () => ({
        getAdapter: () => ({
          healthCheck: async () => ({ ok: true, latencyMs: 1 }),
        }),
      }));
      const { registerHealthRoutes: registerFresh } =
        await import("../../../src/api/routes/health.js");
      const freshApp = express();
      freshApp.use(express.json());
      registerFresh(freshApp);
      freshApp.use(errorHandler);

      const res = await request(freshApp).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeTruthy();
      expect(res.body.erp.ok).toBe(true);
    });
  });

  describe("GET /api/health audit logging", () => {
    it("logs health.fail when adapter throws", async () => {
      vi.resetModules();
      vi.doMock("../../../src/api/adapter-provider.js", () => ({
        getAdapter: () => ({
          healthCheck: async () => {
            throw new Error("ERP down");
          },
        }),
      }));
      vi.doMock("../../../src/lib/app-logger-server.js", () => ({
        logEvent: vi.fn(() => Promise.resolve()),
      }));
      const { registerHealthRoutes: registerFresh } =
        await import("../../../src/api/routes/health.js");
      const { logEvent: freshLogEvent } = await import("../../../src/lib/app-logger-server.js");
      const freshLogEventMock = vi.mocked(freshLogEvent);

      const freshApp = express();
      freshApp.use(express.json());
      registerFresh(freshApp);
      freshApp.use(errorHandler);

      const res = await request(freshApp).get("/api/health");
      expect(res.status).toBe(503);

      expect(freshLogEventMock).toHaveBeenCalledTimes(1);
      const call = freshLogEventMock.mock.calls[0][0];
      expect(call.category).toBe("system");
      expect(call.action).toBe("health.fail");
      expect(call.success).toBe(false);
      expect(call.errorMessage).toBe("ERP down");
    });

    it("does not log when adapter is OK", async () => {
      vi.resetModules();
      vi.doMock("../../../src/api/adapter-provider.js", () => ({
        getAdapter: () => ({
          healthCheck: async () => ({ ok: true, latencyMs: 1 }),
        }),
      }));
      vi.doMock("../../../src/lib/app-logger-server.js", () => ({
        logEvent: vi.fn(() => Promise.resolve()),
      }));
      const { registerHealthRoutes: registerFresh } =
        await import("../../../src/api/routes/health.js");
      const { logEvent: freshLogEvent } = await import("../../../src/lib/app-logger-server.js");
      const freshLogEventMock = vi.mocked(freshLogEvent);

      const freshApp = express();
      freshApp.use(express.json());
      registerFresh(freshApp);
      freshApp.use(errorHandler);

      const res = await request(freshApp).get("/api/health");
      expect(res.status).toBe(200);
      expect(freshLogEventMock).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/company", () => {
    it("returns demo data when no pool", async () => {
      const res = await request(app).get("/api/company");
      expect(res.status).toBe(200);
      expect(res.body.name).toBeTruthy();
    });
  });
});
