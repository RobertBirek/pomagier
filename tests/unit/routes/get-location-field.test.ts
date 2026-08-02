import { describe, it, expect, beforeEach, vi } from "vitest";
import { getLocationField } from "../../../src/api/routes/locations.js";

const mockSelectResults: unknown[] = [];

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({}),
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));

vi.mock("../../../src/db/index.js", () => {
  return {
    getDb: () => ({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            const result = mockSelectResults.shift() ?? [];
            return Promise.resolve(result);
          }),
        }),
      }),
    }),
    schema: {
      config: { key: "key", value: "value", updatedAt: "updatedAt" },
    },
  };
});

describe("getLocationField (T3.4 — SQL injection defense)", () => {
  beforeEach(() => {
    mockSelectResults.length = 0;
  });

  it("returns 'tw_Pole1' when no config row exists", async () => {
    mockSelectResults.push([]);
    const field = await getLocationField();
    expect(field).toBe("tw_Pole1");
  });

  it("returns 'tw_Pole1' for valid whitelisted value 'tw_Pole1'", async () => {
    mockSelectResults.push([{ value: "tw_Pole1" }]);
    const field = await getLocationField();
    expect(field).toBe("tw_Pole1");
  });

  it("accepts tw_Pole2 through tw_Pole8 (whitelisted alternatives)", async () => {
    for (let i = 2; i <= 8; i++) {
      mockSelectResults.push([{ value: `tw_Pole${i}` }]);
      const field = await getLocationField();
      expect(field).toBe(`tw_Pole${i}`);
    }
  });

  it("rejects 'tw_Opis' (would overwrite business data) and falls back to tw_Pole1", async () => {
    mockSelectResults.push([{ value: "tw_Opis" }]);
    const field = await getLocationField();
    expect(field).toBe("tw_Pole1");
  });

  it("rejects 'tw_Uwagi' (would overwrite business data) and falls back to tw_Pole1", async () => {
    mockSelectResults.push([{ value: "tw_Uwagi" }]);
    const field = await getLocationField();
    expect(field).toBe("tw_Pole1");
  });

  it("rejects 'tw_CenaNetto' (price field) and falls back to tw_Pole1", async () => {
    mockSelectResults.push([{ value: "tw_CenaNetto" }]);
    const field = await getLocationField();
    expect(field).toBe("tw_Pole1");
  });

  it("rejects SQL injection attempt and falls back to tw_Pole1", async () => {
    mockSelectResults.push([{ value: "tw_Pole1; DROP TABLE tw__Towar; --" }]);
    const field = await getLocationField();
    expect(field).toBe("tw_Pole1");
  });

  it("rejects arbitrary string and falls back to tw_Pole1", async () => {
    mockSelectResults.push([{ value: "evil_field" }]);
    const field = await getLocationField();
    expect(field).toBe("tw_Pole1");
  });

  it("rejects empty string and falls back to tw_Pole1 (treated as invalid)", async () => {
    mockSelectResults.push([{ value: "" }]);
    const field = await getLocationField();
    expect(field).toBe("tw_Pole1");
  });
});
