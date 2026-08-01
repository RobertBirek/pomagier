import { eq, lt } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import { logEvent } from "../lib/app-logger.js";

const IDEMPOTENCY_TTL = 5 * 60 * 1000;

export async function checkIdempotency(
  key: string,
): Promise<{ result: unknown; statusCode: number } | null> {
  const db = getDb();
  const now = new Date();
  await db.delete(schema.idempotencyKeys).where(lt(schema.idempotencyKeys.expiresAt, now));
  const [entry] = await db
    .select()
    .from(schema.idempotencyKeys)
    .where(eq(schema.idempotencyKeys.key, key));
  if (!entry || entry.expiresAt <= now) return null;
  try {
    const result = { result: JSON.parse(entry.response) as unknown, statusCode: entry.statusCode };
    await logEvent({
      category: "queue",
      action: "idempotency.reused",
      method: "web",
      target: { type: "idempotency", id: key },
      success: true,
      details: { reusedForResponse: result.result },
    });
    return result;
  } catch {
    return null;
  }
}

export async function storeIdempotency(
  key: string,
  result: unknown,
  statusCode = 200,
): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.idempotencyKeys)
    .values({
      key,
      response: JSON.stringify(result),
      statusCode,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL),
    })
    .onConflictDoUpdate({
      target: schema.idempotencyKeys.key,
      set: {
        response: JSON.stringify(result),
        statusCode,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL),
      },
    });
}
