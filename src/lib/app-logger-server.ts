import { getDb, schema } from "../db/index.js";
import { logger } from "./logger.js";
import { getCorrelationId } from "./logger.js";
import { maskSensitive, type LogEvent } from "./app-logger.js";

export type { LogCategory, LogEvent, LogMethod } from "./app-logger.js";

/** Server-only dual-write logger: structured Pino + Postgres audit_log. */
export async function logEvent(event: LogEvent): Promise<void> {
  const correlationId = event.correlationId ?? getCorrelationId();
  const maskedDetails = event.details ? maskSensitive(event.details) : undefined;
  logger.info(
    {
      event: { ...event, details: maskedDetails, correlationId },
      category: event.category,
      action: event.action,
    },
    `[${event.category}] ${event.action}`,
  );
  try {
    const db = getDb();
    await db.insert(schema.auditLog).values({
      correlationId,
      userId: event.actorUserId ?? null,
      action: event.action,
      details: maskedDetails ? JSON.stringify(maskedDetails) : null,
      category: event.category,
      method: event.method ?? null,
      actorSubiektUzId: event.actorSubiektUzId ?? null,
      targetType: event.target?.type ?? null,
      targetId: event.target?.id ?? null,
    });
  } catch (err) {
    logger.error({ err, event: { action: event.action } }, "Failed to write audit log to DB");
  }
}
