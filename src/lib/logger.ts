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

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  serializers: {
    ...pino.stdSerializers,
    secret: () => "***REDACTED***",
  },
  mixin() {
    return { correlationId: getCorrelationId() };
  },
});
