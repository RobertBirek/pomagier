import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

function verifyPin(pin: string, hash: string): boolean {
  return bcrypt.compareSync(pin, hash);
}

describe("Auth utilities", () => {
  it("should verify correct PIN against its hash", () => {
    const hash = hashPin("0000");
    expect(verifyPin("0000", hash)).toBe(true);
  });

  it("should reject wrong PIN", () => {
    const hash = hashPin("0000");
    expect(verifyPin("1111", hash)).toBe(false);
  });

  it("should produce different hashes for same PIN (salt)", () => {
    const hash1 = hashPin("0000");
    const hash2 = hashPin("0000");
    expect(hash1).not.toBe(hash2); // bcrypt uses random salt
  });

  it("should handle empty PIN", () => {
    const hash = hashPin("");
    expect(verifyPin("", hash)).toBe(true);
  });
});
