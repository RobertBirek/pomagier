import { describe, it, expect, beforeAll } from "vitest";

const BASE = "http://localhost:3000";

describe.skipIf(!process.env.RUN_INTEGRATION)("Critical flow: login → scan → assign", () => {
  let cookie: string;

  beforeAll(async () => {
    const r = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subiektUzId: Number(process.env.TEST_SUBIEKT_ID),
        pin: process.env.TEST_PIN,
      }),
    });
    const data = await r.json();
    cookie = r.headers.get("set-cookie")?.split(";", 1)[0] || "";
    expect(cookie).toMatch(/^token=/);
    expect(data.token).toBeUndefined();
  });

  it("should login with correct PIN", async () => {
    expect(cookie.length).toBeGreaterThan(10);
  });

  it("should reject wrong PIN", async () => {
    const r = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subiektUzId: 1, pin: "9999" }),
    });
    expect(r.status).toBe(401);
  });

  it("should scan a product by EAN", async () => {
    const r = await fetch(`${BASE}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ code: "5905316604070" }),
    });
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.found).toBe(true);
    expect(data.products[0].name).toContain("RONDOO");
  });

  it("should return not found for unknown EAN", async () => {
    const r = await fetch(`${BASE}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "0000000000000" }),
    });
    const data = await r.json();
    expect(data.found).toBe(false);
  });

  it("should assign product to location", async () => {
    const r = await fetch(`${BASE}/api/locations/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ codes: ["5905316604070"], location: "A 1-1-1-1" }),
    });
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
  });

  it("should verify locations after assign", async () => {
    const r = await fetch(`${BASE}/api/locations/verify?location=A%201-1-1-1`);
    const data = await r.json();
    expect(data.comparison).toBeTruthy();
    expect(data.comparison.location).toBe("A 1-1-1-1");
  });
});
