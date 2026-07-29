import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { validate } from "../../src/api/validation.js";
import { errorHandler } from "../../src/api/error-handler.js";

const LoginSchema = z.object({
  subiektUzId: z.number().int().positive(),
  pin: z.string().min(4).max(8),
});

describe("validate middleware", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.post("/test", validate(LoginSchema), (req, res) => {
      res.json({ ok: true, body: req.body });
    });
    app.use(errorHandler);
  });

  it("passes valid request body through", async () => {
    const res = await request(app).post("/test").send({ subiektUzId: 1, pin: "1234" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 422 for missing fields", async () => {
    const res = await request(app).post("/test").send({ subiektUzId: 1 });
    expect(res.status).toBe(422);
  });

  it("returns 422 for wrong types", async () => {
    const res = await request(app).post("/test").send({ subiektUzId: "not-a-number", pin: "1234" });
    expect(res.status).toBe(422);
  });
});
