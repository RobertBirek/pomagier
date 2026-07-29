import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../src/lib/logger.js", () => ({ logger: mockLogger }));

import { ApiError, errorHandler } from "../../src/api/error-handler.js";

describe("ApiError", () => {
  it("creates error with status code and message", () => {
    const err = new ApiError(400, "Bad request");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Bad request");
    expect(err.name).toBe("ApiError");
  });

  it("creates 400 error via static factory", () => {
    const err = ApiError.badRequest("Missing field");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Missing field");
  });

  it("creates 422 error via static factory", () => {
    const err = ApiError.unprocessable("Invalid format");
    expect(err.statusCode).toBe(422);
  });

  it("creates 502 error via static factory", () => {
    const err = ApiError.erpError("ERP timeout");
    expect(err.statusCode).toBe(502);
  });
});

describe("errorHandler middleware", () => {
  let app: express.Express;

  beforeEach(() => {
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();

    app = express();
    app.get("/api-error", (_req, _res) => {
      throw ApiError.badRequest("test error");
    });
    app.get("/unknown-error", (_req, _res) => {
      throw new Error("boom");
    });
    app.use(errorHandler);
  });

  it("catches ApiError and returns its status + JSON", async () => {
    const res = await request(app).get("/api-error");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "test error" });
  });

  it("catches unknown Error and returns 500 with generic message", async () => {
    const res = await request(app).get("/unknown-error");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("logs unknown errors via logger.error", async () => {
    await request(app).get("/unknown-error");
    expect(mockLogger.error).toHaveBeenCalledOnce();
  });
});
