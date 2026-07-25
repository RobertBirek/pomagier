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

const serializers = {
  ...pino.stdSerializers,
  secret: () => "***REDACTED***",
};

const mixin = () => {
  return { correlationId: getCorrelationId() };
};

export const logger = pino(
  isProd
    ? {
        ...pino.transport({
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
        }),
        serializers,
        mixin,
      }
    : {
        level: "debug",
        transport: { target: "pino-pretty", options: { colorize: true } },
        serializers,
        mixin,
      }
);
