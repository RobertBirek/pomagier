import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const osMocks = vi.hoisted(() => ({
  totalmem: vi.fn(() => 1000),
  freemem: vi.fn(() => 500),
}));

vi.mock("node:os", () => osMocks);
vi.mock("node:v8", () => ({
  getHeapStatistics: vi.fn(() => ({ heap_size_limit: 1000 })),
}));
vi.mock("../../../src/lib/app-logger-server.js", () => ({
  logEvent: vi.fn(() => Promise.resolve()),
}));

import { logEvent } from "../../../src/lib/app-logger-server.js";

const logEventMock = vi.mocked(logEvent);

function setMemory(heapUsed: number, heapTotal: number): void {
  vi.spyOn(process, "memoryUsage").mockReturnValue({
    heapUsed,
    heapTotal,
    external: 0,
    arrayBuffers: 0,
    rss: heapUsed + heapTotal,
  } as NodeJS.MemoryUsage);
}

describe("startSystemMonitor", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    setMemory(500, 1000);
    osMocks.totalmem.mockReturnValue(1000);
    osMocks.freemem.mockReturnValue(500);
    osMocks.totalmem.mockClear();
    osMocks.freemem.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not log when memory usage is low", async () => {
    setMemory(500, 1000);
    osMocks.totalmem.mockReturnValue(1000);
    osMocks.freemem.mockReturnValue(500);

    const { startSystemMonitor } = await import("../../../src/lib/system-monitor.js");
    const handle = startSystemMonitor(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(logEventMock).not.toHaveBeenCalled();
    clearInterval(handle);
  });

  it("logs memory.warning when heap ratio > 0.8", async () => {
    setMemory(850, 1000);
    osMocks.totalmem.mockReturnValue(1000);
    osMocks.freemem.mockReturnValue(500);

    const { startSystemMonitor } = await import("../../../src/lib/system-monitor.js");
    const handle = startSystemMonitor(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const call = logEventMock.mock.calls[0][0];
    expect(call.category).toBe("system");
    expect(call.action).toBe("memory.warning");
    expect(call.success).toBe(true);
    expect((call.details as Record<string, unknown>).ratio).toBe(0.85);

    clearInterval(handle);
  });

  it("logs disk.warning when free memory ratio < 0.1", async () => {
    setMemory(500, 1000);
    osMocks.totalmem.mockReturnValue(1000);
    osMocks.freemem.mockReturnValue(50);

    const { startSystemMonitor } = await import("../../../src/lib/system-monitor.js");
    const handle = startSystemMonitor(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const call = logEventMock.mock.calls[0][0];
    expect(call.category).toBe("system");
    expect(call.action).toBe("disk.warning");
    expect(call.success).toBe(true);
    expect((call.details as Record<string, unknown>).ratio).toBe(0.05);

    clearInterval(handle);
  });

  it("throttles repeated memory warnings within 5 minutes", async () => {
    setMemory(900, 1000);
    osMocks.totalmem.mockReturnValue(1000);
    osMocks.freemem.mockReturnValue(500);

    const { startSystemMonitor } = await import("../../../src/lib/system-monitor.js");
    const handle = startSystemMonitor(1000);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const call = logEventMock.mock.calls[0][0];
    expect(call.action).toBe("memory.warning");

    clearInterval(handle);
  });
});
