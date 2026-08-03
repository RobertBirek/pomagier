/* eslint-disable */
// @ts-nocheck
// logger.ts - CLIENT-SAFE (no top-level Node imports)
// The server-only code below uses `require` which is only available in Node.
// In the browser, this file falls back to the no-op stub.
// We use `@ts-nocheck` to avoid TypeScript errors from the dynamic `require` access.

const isBrowser = typeof window !== "undefined";

function makeUUID(): string {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const noopStore = {
  run: (_store, fn) => fn(),
  getStore: () => undefined,
};

let correlationStore = noopStore;

if (!isBrowser) {
  try {
    // Server-only: use createRequire to load pino and AsyncLocalStorage.
    // In Vite client build, this whole if-block is preserved (we still need
    // the require check to fail gracefully) but the require call is wrapped
    // in try-catch and will throw in the browser.
    const moduleSpec = globalThis.process && globalThis.process.mainModule ? globalThis.require : null;
    let req = null;
    if (moduleSpec) {
      const { createRequire } = moduleSpec("module");
      req = createRequire(globalThis.process.cwd() + "/");
    }
    if (req) {
      const { AsyncLocalStorage } = req("node:async_hooks");
      correlationStore = new AsyncLocalStorage();
    }
  } catch {
    // Fallback to noop store
  }
}

export function withCorrelation(fn) {
  return correlationStore.run({ correlationId: makeUUID() }, fn);
}

export function getCorrelationId() {
  return correlationStore.getStore()?.correlationId ?? "no-correlation-id";
}

const secret = () => "***REDACTED***";

const serializers = { secret };

const mixin = () => ({ correlationId: getCorrelationId() });

const consoleLogger = {
  info: (obj, msg) => (msg !== undefined ? console.info(`[${msg}]`, obj) : console.info(obj)),
  warn: (obj, msg) => (msg !== undefined ? console.warn(`[${msg}]`, obj) : console.warn(obj)),
  error: (obj, msg) => (msg !== undefined ? console.error(`[${msg}]`, obj) : console.error(obj)),
  debug: (obj, msg) => (msg !== undefined ? console.debug(`[${msg}]`, obj) : console.debug(obj)),
};

let pinoLogger = null;

if (!isBrowser) {
  try {
    const moduleSpec = globalThis.process && globalThis.process.mainModule ? globalThis.require : null;
    let req = null;
    if (moduleSpec) {
      const { createRequire } = moduleSpec("module");
      req = createRequire(globalThis.process.cwd() + "/");
    }
    if (req) {
      const pino = req("pino");
      const isProd = globalThis.process?.env?.NODE_ENV === "production";
      pinoLogger = pino(
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
    }
  } catch {
    // Fallback
  }
}

export const logger = pinoLogger || consoleLogger;
export { isBrowser };
