// Browser-safe event logger. Server persistence lives in app-logger-server.ts.

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
    if (SENSITIVE_KEYS.has(key.toLowerCase())) masked[key] = "***REDACTED***";
    else if (Array.isArray(value)) {
      masked[key] = value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? maskSensitive(item as Record<string, unknown>)
          : item,
      );
    } else if (value && typeof value === "object") {
      masked[key] = maskSensitive(value as Record<string, unknown>);
    } else masked[key] = value;
  }
  return masked;
}

/** Client-side queue events are observable in DevTools only; no DB imports here. */
export async function logEvent(event: LogEvent): Promise<void> {
  const details = event.details ? maskSensitive(event.details) : undefined;
  console.info(`[${event.category}] ${event.action}`, { ...event, details });
}
