import crypto from "node:crypto";
import { logger } from "./logger.js";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12; // 96 bits for GCM
const TAG_LEN = 16; // 128 bits auth tag
const PREFIX = "aes:";

function getKey(): Buffer {
  const secret = process.env.JWT_SECRET || "pomagier-dev-key-change-me";
  return crypto.scryptSync(secret, "pomagier-salt", KEY_LEN);
}

/** Encrypt a string value. Returns "aes:<base64>" or original if encryption fails. */
export function encryptConfig(value: string): string {
  try {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, tag, encrypted]);
    return PREFIX + combined.toString("base64");
  } catch (err) {
    logger.error({ err }, "Config encryption failed — storing plaintext");
    return value;
  }
}

/** Decrypt an aes:-prefixed string. Returns plaintext value. */
export function decryptConfig(value: string): string {
  if (!value.startsWith(PREFIX)) return value; // Plaintext (legacy or fallback)
  try {
    const combined = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = combined.subarray(0, IV_LEN);
    const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const encrypted = combined.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch (err) {
    logger.error({ err }, "Config decryption failed");
    return value.replace(PREFIX, ""); // Best-effort: return stripped prefix
  }
}
