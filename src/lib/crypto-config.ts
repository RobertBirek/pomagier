import crypto from "node:crypto";
import { logger } from "./logger.js";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12; // 96 bits for GCM
const TAG_LEN = 16; // 128 bits auth tag
const PREFIX = "aes:";

function getKey(): Buffer {
  // Prefer CONFIG_ENCRYPTION_KEY (dedicated secret). Fall back to JWT_SECRET for backward compat
  // with values encrypted before CONFIG_ENCRYPTION_KEY was introduced (logged as warning).
  const secret = process.env.CONFIG_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 8) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CONFIG_ENCRYPTION_KEY (or JWT_SECRET) must be set in production for config encryption",
      );
    }
    logger.warn(
      "Config encryption using fallback dev key — set CONFIG_ENCRYPTION_KEY in production",
    );
    return crypto.scryptSync("pomagier-dev-key-change-me", "pomagier-salt", KEY_LEN);
  }
  // Per-record random salt would be ideal, but backward compat requires static salt for existing values.
  // New installations should use CONFIG_ENCRYPTION_KEY for clean separation.
  return crypto.scryptSync(secret, "pomagier-salt", KEY_LEN);
}

/** Encrypt a string value. Returns "aes:<base64>". Throws on failure — NEVER falls back to plaintext. */
export function encryptConfig(value: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, encrypted]);
  return PREFIX + combined.toString("base64");
}

/** Decrypt an aes:-prefixed string. Returns plaintext value or empty string on failure. */
export function decryptConfig(value: string): string {
  if (!value.startsWith(PREFIX)) return value; // Plaintext (legacy pre-encryption)
  try {
    const combined = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = combined.subarray(0, IV_LEN);
    const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const encrypted = combined.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch (err) {
    logger.error({ err }, "Config decryption failed — returning empty");
    return "";
  }
}
