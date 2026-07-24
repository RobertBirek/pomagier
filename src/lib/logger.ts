import pino from "pino";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

const correlationStore = new AsyncLocalStorage<{ correlationId: string }>();

export function withCorrelation<T>(fn: () => T): T {
  const correlationId = randomUUID();
  return correlationStore.run({ correlationId }, fn);
}

export function getCorrelationId(): string {
  return correlationStore.getStore()?.correlationId ?? "no-correlation-id";
}

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: isProd ? "info" : "debug",
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
  mixin() {
    return { correlationId: getCorrelationId() };
  },
  serializers: {
    ...pino.stdSerializers,
    secret: () => "***REDACTED***",
  },
});
