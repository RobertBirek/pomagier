// app-logger.ts - BROWSER-SAFE
// No top-level imports of postgres, getDb, or pino.
// All server-only code is inside `if (import.meta.env.SSR)` blocks
// so Vite tree-shakes it from the client bundle.
//
// Server path: dynamic import("../db/index.js") at call time.

const isServer = import.meta.env.SSR;
import { getCorrelationId as getLoggerCorrelationId } from "./logger.js";

// ============================================
// Console fallback for browser
// ============================================

const consoleStub = {
  info: (obj: unknown, msg?: string): void => {
    if (msg !== undefined) console.info(`[${msg}]`, obj);
    else console.info(obj);
  },
  warn: (obj: unknown, msg?: string): void => {
    if (msg !== undefined) console.warn(`[${msg}]`, obj);
    else console.warn(obj);
  },
  error: (obj: unknown, msg?: string): void => {
    if (msg !== undefined) console.error(`[${msg}]`, obj);
    else console.error(obj);
  },
  debug: (obj: unknown, msg?: string): void => {
    if (msg !== undefined) console.debug(`[${msg}]`, obj);
    else console.debug(obj);
  },
};

// ============================================
// Server logger (lazy-init with dynamic import of pino)
// ============================================

let _serverLogger: typeof consoleStub | null = null;
let _serverLoggerLoading: Promise<typeof consoleStub> | null = null;

async function loadServerLogger(): Promise<typeof consoleStub> {
  if (!isServer) return consoleStub;
  if (_serverLogger) return _serverLogger;
  if (_serverLoggerLoading) return _serverLoggerLoading;
  _serverLoggerLoading = (async () => {
    try {
      // @vite-ignore - dynamic import is server-only, tell Vite to skip analysis
      const { default: pino } = await import("pino");
      const isProd = process.env.NODE_ENV === "production";
      _serverLogger = pino(
        isProd
          ? {
              transport: {
                targets: [
                  { target: "pino/file", options: { destination: 1 } },
                  {
                    target: "pino-roll",
                    options: {
                      file: "/var/log/pomagier/api",
                      frequency: "daily",
                      mkdir: true,
                      limit: { count: 7 },
                    },
                  },
                ],
              },
            }
          : {
              level: "debug",
              transport: { target: "pino-pretty", options: { colorize: true } },
            },
      ) as typeof consoleStub;
      return _serverLogger!;
    } catch (err) {
      console.error("[app-logger] Failed to load pino, falling back to console:", err);
      return consoleStub;
    }
  })();
  return _serverLoggerLoading;
}

// Server logger eager-init at module load (only on server).
// This avoids async issues at call sites.
if (isServer) {
  // Fire and forget - logger will be available by the time it's used
  void loadServerLogger();
}

// ============================================
// Public logger export - Proxy for lazy resolution
// ============================================

export const logger: typeof consoleStub = new Proxy(consoleStub, {
  get(_target, prop) {
    // For now return consoleStub - server logger is only used directly
    // in Node where the eager-init above has populated _serverLogger.
    // In browser, consoleStub is what we want.
    return Reflect.get(_serverLogger || consoleStub, prop);
  },
}) as typeof consoleStub;

// ============================================
// Types
// ============================================

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

// ============================================
// Sensitive key masking
// ============================================

const SENSITIVE_KEYS = new Set(["pin", "password", "token", "cookie", "authorization"]);

export function maskSensitive<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return obj as unknown as Record<string, unknown>;
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      masked[key] = "***REDACTED***";
    } else if (Array.isArray(value)) {
      masked[key] = value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? maskSensitive(item as Record<string, unknown>)
          : item,
      );
    } else if (value && typeof value === "object") {
      masked[key] = maskSensitive(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

// ============================================
// logEvent - server only writes to DB, browser just consoles
// ============================================

export async function logEvent(event: LogEvent): Promise<void> {
  const correlationId = event.correlationId ?? getLoggerCorrelationId();
  const maskedDetails = event.details
    ? (maskSensitive(event.details) as Record<string, unknown>)
    : undefined;

  if (isServer) {
    // Server path: dynamic import for db and schema
    try {
      const serverLogger = await loadServerLogger();
      if (maskedDetails !== undefined) {
        serverLogger.info(
          {
            event: { ...event, details: maskedDetails, correlationId },
            category: event.category,
            action: event.action,
          },
          `[${event.category}] ${event.action}`,
        );
      } else {
        serverLogger.info(
          { event: { ...event, correlationId }, category: event.category, action: event.action },
          `[${event.category}] ${event.action}`,
        );
      }

      // Dynamic import db (also server-only)
      const { getDb, schema } = await import("../db/index.js");
      const db = getDb();
      const detailsJson = maskedDetails ? JSON.stringify(maskedDetails) : null;
      await db.insert(schema.auditLog).values({
        correlationId,
        userId: event.actorUserId ?? null,
        action: event.action,
        details: detailsJson,
        category: event.category,
        method: event.method ?? null,
        actorSubiektUzId: event.actorSubiektUzId ?? null,
        targetType: event.target?.type ?? null,
        targetId: event.target?.id ?? null,
      });
    } catch (err) {
      logger.error({ err, event: { action: event.action } }, "Failed to write audit log to DB");
    }
  } else {
    // Browser: just console
    logger.info(
      {
        event: { ...event, details: maskedDetails, correlationId },
        category: event.category,
        action: event.action,
      },
      `[${event.category}] ${event.action}`,
    );
  }
}

// Side-effect: ensure server logger is loaded eagerly on server start
if (isServer) {
  void loadServerLogger();
}

export { isServer };
