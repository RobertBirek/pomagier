import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

describe("Auth utilities", () => {
  it("should hash PIN consistently", () => {
    expect(hashPin("0000")).toBe(hashPin("0000"));
    expect(hashPin("0000").length).toBe(64);
  });

  it("should produce different hashes for different PINs", () => {
    expect(hashPin("0000")).not.toBe(hashPin("1111"));
  });

  it("should handle empty PIN", () => {
    const h = hashPin("");
    expect(h.length).toBe(64);
  });
});
