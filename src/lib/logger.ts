import pino from "pino";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

// Browser-safe stubs (used at runtime in the browser)
const isBrowser = typeof window !== "undefined";

interface ICorrelationStore {
  run: <T>(store: { correlationId: string }, fn: () => T) => T;
  getStore: () => { correlationId: string } | undefined;
}

const noopStore: ICorrelationStore = {
  run: <_T>(_store: { correlationId: string }, fn: () => _T): _T => fn(),
  getStore: (): { correlationId: string } | undefined => undefined,
};

const correlationStore: ICorrelationStore = isBrowser
  ? noopStore
  : (new AsyncLocalStorage<{ correlationId: string }>() as unknown as ICorrelationStore);

const browserRandomUUID = (): string => {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function withCorrelation<T>(fn: () => T): T {
  return correlationStore.run({ correlationId: randomUUID() }, fn);
}

export function getCorrelationId(): string {
  return correlationStore.getStore()?.correlationId ?? "no-correlation-id";
}

const secret = () => "***REDACTED***";

const serializers = {
  ...pino.stdSerializers,
  secret,
};

const mixin = () => {
  return { correlationId: getCorrelationId() };
};

const consoleLogger = {
  info: (obj: unknown, msg?: string) => {
    if (msg) console.info(`[${msg}]`, obj);
    else console.info(obj);
  },
  warn: (obj: unknown, msg?: string) => {
    if (msg) console.warn(`[${msg}]`, obj);
    else console.warn(obj);
  },
  error: (obj: unknown, msg?: string) => {
    if (msg) console.error(`[${msg}]`, obj);
    else console.error(obj);
  },
  debug: (obj: unknown, msg?: string) => {
    if (msg) console.debug(`[${msg}]`, obj);
    else console.debug(obj);
  },
};

const isProd = process.env.NODE_ENV === "production";

export const logger = isBrowser
  ? (consoleLogger as unknown as pino.Logger)
  : pino(
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
          },
    );
