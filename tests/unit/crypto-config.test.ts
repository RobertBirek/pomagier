import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptConfig, decryptConfig } from "../../src/lib/crypto-config.js";

describe("crypto-config", () => {
  const origJwt = process.env.JWT_SECRET;
  const origConfigKey = process.env.CONFIG_ENCRYPTION_KEY;
  const origNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-for-encryption-roundtrip-32chars";
    delete process.env.CONFIG_ENCRYPTION_KEY;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.JWT_SECRET = origJwt;
    process.env.CONFIG_ENCRYPTION_KEY = origConfigKey;
    process.env.NODE_ENV = origNodeEnv;
  });

  it("encrypts and decrypts a value round-trip", () => {
    const plaintext = "my-super-secret-mssql-password-123";
    const encrypted = encryptConfig(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.startsWith("aes:")).toBe(true);

    const decrypted = decryptConfig(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("returns plaintext as-is for legacy values (no aes: prefix)", () => {
    const legacy = "plaintext-password";
    expect(decryptConfig(legacy)).toBe(legacy);
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const plaintext = "same-value";
    const enc1 = encryptConfig(plaintext);
    const enc2 = encryptConfig(plaintext);
    expect(enc1).not.toBe(enc2);
    expect(decryptConfig(enc1)).toBe(plaintext);
    expect(decryptConfig(enc2)).toBe(plaintext);
  });

  it("decrypts with CONFIG_ENCRYPTION_KEY when set", () => {
    process.env.CONFIG_ENCRYPTION_KEY = "dedicated-config-encryption-key-32chars";
    const plaintext = "password-via-config-key";
    const encrypted = encryptConfig(plaintext);
    expect(decryptConfig(encrypted)).toBe(plaintext);
  });

  it("returns empty string on decryption failure (corrupt data)", () => {
    const corrupt = "aes:not-valid-base64-data-at-all!!!";
    const result = decryptConfig(corrupt);
    expect(result).toBe("");
  });
});
