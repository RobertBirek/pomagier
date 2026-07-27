import crypto from "node:crypto";

const ALGORITHM = "aes-256-cbc";
const KEY = process.env.BACKUP_ENCRYPTION_KEY || "pomagier-dev-backup-key-change-me";
if (process.env.NODE_ENV === "production" && KEY === "pomagier-dev-backup-key-change-me") {
  throw new Error("BACKUP_ENCRYPTION_KEY required in production");
}

function getKey(): Buffer {
  return crypto.createHash("sha256").update(KEY).digest();
}

export function encryptSecret(text: string, key?: Buffer): string {
  const effectiveKey = key || getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, effectiveKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptSecret(encrypted: string, key?: Buffer): string {
  const effectiveKey = key || getKey();
  const [ivHex, dataHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, effectiveKey, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
