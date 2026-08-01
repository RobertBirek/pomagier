import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const logEventMock = vi.hoisted(() =>
  vi.fn<(event: Record<string, unknown>) => Promise<void>>(() => Promise.resolve()),
);

const listenCallbacks = vi.hoisted(() => [] as Array<() => void | Promise<void>>);

const fakeServer = vi.hoisted(() => ({
  close: vi.fn((cb?: () => void) => {
    if (cb) cb();
  }),
}));

const fakeApp = vi.hoisted(() => {
  const app = {
    use: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    get: vi.fn().mockReturnThis(),
    post: vi.fn().mockReturnThis(),
    put: vi.fn().mockReturnThis(),
    patch: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    listen: vi.fn((_port: number, cb: () => void) => {
      listenCallbacks.push(cb);
      return fakeServer;
    }),
  };
  return app;
});

vi.mock("express", () => {
  const expressFn = (() => fakeApp) as unknown as Record<string, unknown>;
  expressFn.json = vi.fn();
  return { default: expressFn };
});

vi.mock("../../../src/lib/app-logger.js", () => ({
  logEvent: logEventMock,
}));

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({ insert: vi.fn() }),
  schema: { auditLog: {} },
}));

vi.mock("../../../src/lib/cleanup.js", () => ({
  startCleanupInterval: vi.fn(),
  runCleanup: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => ({ close: vi.fn(() => Promise.resolve()) }),
}));

const originalExit = process.exit;
const exitMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  listenCallbacks.length = 0;
  logEventMock.mockReset();
  logEventMock.mockImplementation(() => Promise.resolve());
  exitMock.mockReset();
  process.exit = exitMock as never;
  process.removeAllListeners("SIGTERM");
  process.removeAllListeners("SIGINT");
  vi.resetModules();
});

afterEach(() => {
  process.exit = originalExit;
  process.removeAllListeners("SIGTERM");
  process.removeAllListeners("SIGINT");
});

const importServer = async () => {
  await import("../../../src/api/server.js");
};

const waitFor = async (predicate: () => boolean, timeoutMs = 1000) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 5));
  }
};

describe("server lifecycle logEvent (Sprint 8 T4)", () => {
  it("emits logEvent with action=startup when app.listen callback fires", async () => {
    await importServer();
    expect(listenCallbacks).toHaveLength(1);

    await listenCallbacks[0]();

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.category).toBe("system");
    expect(event.action).toBe("startup");
    expect(event.method).toBe("system");
    expect(event.target).toEqual({ type: "system", id: "api" });
    expect(event.success).toBe(true);
    expect(event.details).toEqual(
      expect.objectContaining({
        port: expect.any(Number),
        nodeVersion: process.version,
        pid: process.pid,
      }),
    );
  });

  it("emits logEvent with action=shutdown when SIGTERM fires", async () => {
    await importServer();
    await listenCallbacks[0]();
    logEventMock.mockClear();

    process.emit("SIGTERM");
    await waitFor(() => exitMock.mock.calls.length > 0);

    expect(logEventMock).toHaveBeenCalled();
    const event = logEventMock.mock.calls[0][0];
    expect(event.category).toBe("system");
    expect(event.action).toBe("shutdown");
    expect(event.method).toBe("system");
    expect(event.target).toEqual({ type: "system", id: "api" });
    expect(event.success).toBe(true);
    expect(event.details).toEqual({ signal: "SIGTERM" });
    expect(exitMock).toHaveBeenCalledWith(0);
  });

  it("does not crash startup if logEvent throws", async () => {
    logEventMock.mockImplementationOnce(() => Promise.reject(new Error("audit log down")));

    await importServer();
    expect(listenCallbacks).toHaveLength(1);

    await expect(listenCallbacks[0]()).rejects.toThrow("audit log down");
    expect(logEventMock).toHaveBeenCalledTimes(1);
  });
});
