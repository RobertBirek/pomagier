import { getDb, schema } from "../db/index.js";
import { logger as pinoLogger } from "./logger.js";
import { getCorrelationId } from "./logger.js";

export type LogCategory = "auth" | "admin" | "mobile" | "erp" | "queue" | "system";
export type LogMethod = "web" | "mobile" | "system" | "verification";

export interface LogEvent {
  category: LogCategory;
  action: string;
  method?: LogMethod;
  actorSubiektUzId?: number;
  actorUserId?: string;
  target?: { type: string; id: string };
  details?: Record<string, unknown>;
  durationMs?: number;
  success?: boolean;
  errorMessage?: string;
  correlationId?: string;
}

const SENSITIVE_KEYS = new Set(["pin", "password", "token", "cookie", "authorization"]);

export function maskSensitive<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return obj as unknown as Record<string, unknown>;
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      masked[key] = "***REDACTED***";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      masked[key] = maskSensitive(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export async function logEvent(event: LogEvent): Promise<void> {
  const correlationId = event.correlationId ?? getCorrelationId();
  pinoLogger.info(
    { event: { ...event, correlationId }, category: event.category, action: event.action },
    `[${event.category}] ${event.action}`,
  );
  try {
    const db = getDb();
    const maskedDetails = event.details ? JSON.stringify(maskSensitive(event.details)) : null;
    await db.insert(schema.auditLog).values({
      correlationId,
      userId: event.actorUserId ?? null,
      action: event.action,
      details: maskedDetails,
      category: event.category,
      method: event.method ?? null,
      actorSubiektUzId: event.actorSubiektUzId ?? null,
      targetType: event.target?.type ?? null,
      targetId: event.target?.id ?? null,
    });
  } catch (err) {
    pinoLogger.error({ err, event: { action: event.action } }, "Failed to write audit log to DB");
  }
}
