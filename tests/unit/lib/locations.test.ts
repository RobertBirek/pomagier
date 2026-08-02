import { describe, it, expect } from "vitest";
import {
  parseLocation,
  safeSubiektValue,
  isMalformedCode,
  sortLocations,
  groupByArea,
  type LocationParsed,
} from "../../../src/lib/locations.js";

function parsedAll(codes: string[]): LocationParsed[] {
  return codes.map(parseLocation).filter((p): p is LocationParsed => p !== null);
}

describe("parseLocation", () => {
  it("parses canonical format with space", () => {
    const p = parseLocation("A 1-2-3-4");
    expect(p).toEqual({
      raw: "A 1-2-3-4",
      area: "A",
      aisle: 1,
      rack: 2,
      shelf: 3,
      spot: 4,
      label: "Obszar A, Alejka 1, Regał 2, Półka 3",
    });
  });

  it("parses lowercase area", () => {
    const p = parseLocation("a 1-2-3-4");
    expect(p?.raw).toBe("A 1-2-3-4");
    expect(p?.area).toBe("A");
  });

  it("inserts space when missing (A1-2-3-4 → A 1-2-3-4)", () => {
    const p = parseLocation("A1-2-3-4");
    expect(p?.raw).toBe("A 1-2-3-4");
  });

  it("tolerates extra spaces around the area", () => {
    const p = parseLocation("  A   1-2-3-4  ");
    expect(p?.raw).toBe("A 1-2-3-4");
  });

  it("rejects too few segments", () => {
    expect(parseLocation("A 1-2-3")).toBeNull();
  });

  it("rejects too many segments", () => {
    expect(parseLocation("A 1-2-3-4-5")).toBeNull();
  });

  it("rejects invalid area chars (digit, symbol)", () => {
    expect(parseLocation("1 1-2-3-4")).toBeNull();
    expect(parseLocation("@ 1-2-3-4")).toBeNull();
  });

  it("rejects non-numeric segments", () => {
    expect(parseLocation("A x-2-3-4")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseLocation("")).toBeNull();
    expect(parseLocation("   ")).toBeNull();
  });
});

describe("safeSubiektValue", () => {
  it("joins codes with comma", () => {
    expect(safeSubiektValue(["A 1-2-3-4", "B 2-3-4-5"])).toBe("A 1-2-3-4,B 2-3-4-5");
  });

  it("returns empty string for empty input", () => {
    expect(safeSubiektValue([])).toBe("");
  });

  it("throws when joined value exceeds 50 chars (Subiekt varchar(50))", () => {
    const longCodes = [
      "A 1-2-3-4", // 9
      "B 2-3-4-5", // 9
      "C 3-4-5-6", // 9
      "D 4-5-6-7", // 9
      "E 5-6-7-8", // 9
      "F 6-7-8-9", // 9
    ];
    // 6*9 + 5 commas = 59 > 50
    expect(() => safeSubiektValue(longCodes)).toThrow(/50/);
  });

  it("throws for 4 codes of 12-13 chars (real overflow case)", () => {
    const codes = ["A 11-22-33-44", "B 12-23-34-45", "C 13-24-35-46", "D 14-25-36-47"];
    // each ~12 chars + 3 commas = 51+ > 50
    expect(() => safeSubiektValue(codes)).toThrow(/50/);
  });

  it("accepts up to 50 chars (boundary)", () => {
    // 3 codes of 9 chars = 27 + 2 commas = 29 — well under
    const codes = ["A 1-2-3-4", "B 1-2-3-4", "C 1-2-3-4"];
    const joined = safeSubiektValue(codes);
    expect(joined.length).toBeLessThanOrEqual(50);
  });
});

describe("isMalformedCode", () => {
  it("returns false for empty string (not malformed, just absent)", () => {
    expect(isMalformedCode("")).toBe(false);
    expect(isMalformedCode("   ")).toBe(false);
  });

  it("returns false for valid codes", () => {
    expect(isMalformedCode("A 1-2-3-4")).toBe(false);
    expect(isMalformedCode("B 11-22-33-44")).toBe(false);
  });

  it("returns true for codes without letter+digit prefix", () => {
    expect(isMalformedCode("1-2-3-4")).toBe(true);
    expect(isMalformedCode("X")).toBe(true);
  });

  it("returns true for codes that fail to parse", () => {
    expect(isMalformedCode("A 1-2-3")).toBe(true);
    expect(isMalformedCode("A 1-2-3-4-5")).toBe(true);
    expect(isMalformedCode("A x-2-3-4")).toBe(true);
  });
});

describe("sortLocations", () => {
  it("sorts by area then aisle then rack then shelf", () => {
    const parsed = parsedAll(["B 2-1-1-1", "A 1-1-1-1", "A 2-1-1-1", "A 1-2-1-1"]);
    const sorted = sortLocations(parsed);
    expect(sorted.map((p) => p.raw)).toEqual(["A 1-1-1-1", "A 1-2-1-1", "A 2-1-1-1", "B 2-1-1-1"]);
  });

  it("does not mutate input", () => {
    const input = parsedAll(["B 1-1-1-1", "A 1-1-1-1"]);
    const copy = [...input];
    sortLocations(input);
    expect(input).toEqual(copy);
  });
});

describe("groupByArea", () => {
  it("groups locations by area preserving sort order", () => {
    const parsed = parsedAll(["B 1-1-1-1", "A 1-1-1-1", "A 2-1-1-1"]);
    const map = groupByArea(parsed);
    expect(map.get("A")?.length).toBe(2);
    expect(map.get("B")?.length).toBe(1);
    expect(map.get("A")?.[0]?.raw).toBe("A 1-1-1-1");
  });
});
