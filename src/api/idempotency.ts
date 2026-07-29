const idempotencyStore = new Map<string, { result: unknown; timestamp: number }>();
const IDEMPOTENCY_TTL = 5 * 60 * 1000; // 5 minutes

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of idempotencyStore) {
    if (now - val.timestamp > IDEMPOTENCY_TTL) idempotencyStore.delete(key);
  }
}, 60000);

export function checkIdempotency(key: string): { result: unknown } | null {
  const entry = idempotencyStore.get(key);
  if (entry && Date.now() - entry.timestamp < IDEMPOTENCY_TTL) {
    return { result: entry.result };
  }
  return null;
}

export function storeIdempotency(key: string, result: unknown): void {
  idempotencyStore.set(key, { result, timestamp: Date.now() });
}
