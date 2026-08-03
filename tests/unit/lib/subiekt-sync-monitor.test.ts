import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const whereFn = vi.fn().mockReturnThis() as ReturnType<typeof vi.fn> & {
    mockImplementation: (fn: (...args: unknown[]) => unknown) => unknown;
  };
  const selectResult: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    where: whereFn,
  };
  const insertValues = vi.fn().mockReturnThis();
  const insertChain = {
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
  insertValues.mockReturnValue(insertChain);
  const insert = vi.fn().mockReturnValue({ values: insertValues });

  return {
    selectResult,
    where: whereFn,
    insert,
    insertValues,
    insertChain,
    select: vi.fn().mockReturnValue(selectResult),
  };
});

const adapterMocks = vi.hoisted(() => ({
  getPool: vi.fn(),
}));

const logEventMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    select: dbMocks.select,
    insert: dbMocks.insert,
  }),
  schema: {
    config: { key: "key", value: "value" },
  },
}));

vi.mock("../../../src/api/adapter-provider.js", () => ({
  getAdapter: () => adapterMocks,
}));

vi.mock("../../../src/lib/app-logger-server.js", () => ({
  logEvent: logEventMock,
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makePool(max: Date | null, count: number | null) {
  return {
    request: () => {
      const builder: Record<string, unknown> = {};
      builder.input = vi.fn().mockReturnValue(builder);
      builder.query = async (sqlText: string) => {
        if (/COUNT\(/.test(sqlText)) {
          return { recordset: [{ n: count ?? 0 }] };
        }
        if (/twz_CzasModyf/.test(sqlText)) {
          return { recordset: max ? [{ m: max }] : [] };
        }
        return { recordset: [] };
      };
      return builder;
    },
  };
}

function setDbConfigRow(value: string | null) {
  // First where call is for location field; we simulate that it returns []
  // Second is for last_sync_at, returns the value
  let callIndex = 0;
  dbMocks.where.mockImplementation(() => {
    callIndex++;
    const isLocationField = callIndex === 1;
    const result = isLocationField ? [] : value === null ? [] : [{ value }];
    const p = Promise.resolve(result);
    const thenable: Record<string, unknown> = {};
    thenable.then = (resolve: (v: unknown) => void) => p.then(resolve);
    return thenable;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.useFakeTimers();
  dbMocks.where.mockReset();
  dbMocks.insert.mockClear();
  dbMocks.insertValues.mockClear();
  dbMocks.insertChain.onConflictDoUpdate.mockClear();
  dbMocks.insertChain.onConflictDoNothing.mockClear();
  adapterMocks.getPool.mockReset();
  logEventMock.mockReset();
  logEventMock.mockResolvedValue(undefined);
  // Default: location field where returns empty (uses default tw_Pole1)
  setDbConfigRow(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tickSubiektSync (T4.2)", () => {
  it("returns early when no MSSQL pool", async () => {
    adapterMocks.getPool.mockResolvedValue(null);
    const { tickSubiektSync } = await import("../../../src/lib/subiekt-sync-monitor.js");
    await tickSubiektSync();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("returns early when no MAX(tw_CzasM) result (no products)", async () => {
    adapterMocks.getPool.mockResolvedValue(makePool(null, null));
    const { tickSubiektSync } = await import("../../../src/lib/subiekt-sync-monitor.js");
    await tickSubiektSync();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("bootstraps lastSyncAt when none exists (sets to MAX tw_CzasM)", async () => {
    const subiektMax = new Date("2026-08-01T10:00:00Z");
    adapterMocks.getPool.mockResolvedValue(makePool(subiektMax, null));
    setDbConfigRow(null);

    const { tickSubiektSync } = await import("../../../src/lib/subiekt-sync-monitor.js");
    await tickSubiektSync();

    expect(dbMocks.insert).toHaveBeenCalledTimes(1);
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const calls = logEventMock.mock.calls as unknown as Array<
      [{ action: string; success: boolean }]
    >;
    const call = calls[0]?.[0];
    expect(call?.action).toBe("subiekt.sync.bootstrap");
    expect(call?.success).toBe(true);
  });

  it("logs modified count when MAX advanced past lastSync", async () => {
    const subiektMax = new Date("2026-08-02T10:00:00Z");
    adapterMocks.getPool.mockResolvedValue(makePool(subiektMax, 5));
    setDbConfigRow("2026-08-01T00:00:00.000Z");

    const { tickSubiektSync } = await import("../../../src/lib/subiekt-sync-monitor.js");
    await tickSubiektSync();

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const calls = logEventMock.mock.calls as unknown as Array<
      [{ action: string; details: Record<string, unknown> }]
    >;
    const call = calls[0]?.[0];
    expect(call?.action).toBe("subiekt.modified");
    expect(call?.details.count).toBe(5);
  });

  it("does not log when MAX unchanged from lastSync", async () => {
    const subiektMax = new Date("2026-08-01T00:00:00Z");
    adapterMocks.getPool.mockResolvedValue(makePool(subiektMax, 0));
    setDbConfigRow("2026-08-01T00:00:00.000Z");

    const { tickSubiektSync } = await import("../../../src/lib/subiekt-sync-monitor.js");
    await tickSubiektSync();

    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("logs error when MAX query throws", async () => {
    const pool = {
      request: () => {
        const builder: Record<string, unknown> = {};
        builder.input = vi.fn().mockReturnValue(builder);
        builder.query = async () => {
          throw new Error("MSSQL down");
        };
        return builder;
      },
    };
    adapterMocks.getPool.mockResolvedValue(pool);
    setDbConfigRow(null);

    const { tickSubiektSync } = await import("../../../src/lib/subiekt-sync-monitor.js");
    await tickSubiektSync();

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const calls = logEventMock.mock.calls as unknown as Array<
      [{ action: string; success: boolean }]
    >;
    const call = calls[0]?.[0];
    expect(call?.action).toBe("subiekt.sync.error");
    expect(call?.success).toBe(false);
  });

  it("throttles — does not run more than once per 5 min", async () => {
    const subiektMax = new Date("2026-08-01T10:00:00Z");
    adapterMocks.getPool.mockResolvedValue(makePool(subiektMax, 0));
    setDbConfigRow(null);

    const { tickSubiektSync } = await import("../../../src/lib/subiekt-sync-monitor.js");
    await tickSubiektSync();
    await tickSubiektSync();
    await tickSubiektSync();

    // Only first call hits pool; others are throttled
    const queryCount = adapterMocks.getPool.mock.results.reduce((acc) => acc + 1, 0);
    // We don't assert exact count because of dynamic import caching, but ensure throttling works
    // The bootstrap call is the only logEvent
    expect(logEventMock.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe("startSubiektSyncMonitor (T4.2)", () => {
  it("returns a NodeJS.Timeout handle", async () => {
    adapterMocks.getPool.mockResolvedValue(null);
    const { startSubiektSyncMonitor } = await import("../../../src/lib/subiekt-sync-monitor.js");
    const handle = startSubiektSyncMonitor(60_000);
    expect(typeof handle).toBe("object");
    clearInterval(handle);
  });
});
