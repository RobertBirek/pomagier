import { describe, it, expect, beforeEach, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const txDelete = vi.fn();
  const txWhere = vi.fn();
  return {
    transaction: vi.fn(),
    txDelete,
    txWhere,
  };
});

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    transaction: dbMocks.transaction,
  }),
  schema: {
    auditLog: { createdAt: "created_at" },
    productMovements: { createdAt: "created_at" },
  },
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  lt: vi.fn((col: unknown, val: unknown) => ({ op: "lt", col, val })),
}));

function setupTxMocks() {
  dbMocks.transaction.mockReset();
  dbMocks.txDelete.mockReset();
  dbMocks.txWhere.mockReset();
  dbMocks.transaction.mockImplementation(async (cb: (tx: { delete: typeof dbMocks.txDelete }) => unknown) => {
    return cb({ delete: dbMocks.txDelete });
  });
  dbMocks.txDelete.mockReturnValue({ where: dbMocks.txWhere });
}

describe("runCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTxMocks();
  });

  it("deletes rows older than 30 days from both tables", async () => {
    dbMocks.txWhere.mockResolvedValueOnce({ count: 5 }).mockResolvedValueOnce({ count: 5 });

    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    const result = await runCleanup();

    expect(dbMocks.txDelete).toHaveBeenCalledTimes(2);
    expect(result.auditDeleted).toBe(5);
    expect(result.movementsDeleted).toBe(5);
  });

  it("returns 0 when no rows match", async () => {
    dbMocks.txWhere.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 });

    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    const result = await runCleanup();

    expect(result.auditDeleted).toBe(0);
    expect(result.movementsDeleted).toBe(0);
  });

  it("handles null count (defensive)", async () => {
    dbMocks.txWhere.mockResolvedValueOnce({ count: null }).mockResolvedValueOnce({ count: null });

    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    const result = await runCleanup();

    expect(result.auditDeleted).toBe(0);
    expect(result.movementsDeleted).toBe(0);
  });

  it("wraps both deletes in a single transaction using the same tx (atomicity)", async () => {
    dbMocks.txWhere.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 3 });

    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    await runCleanup();

    expect(dbMocks.transaction).toHaveBeenCalledTimes(1);
    expect(dbMocks.txDelete).toHaveBeenCalledTimes(2);
    expect(dbMocks.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      dbMocks.txDelete.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
});

describe("startCleanupInterval", () => {
  it("returns a timer handle", async () => {
    const { startCleanupInterval } = await import("../../../src/lib/cleanup.js");
    const handle = startCleanupInterval(1000);
    expect(typeof handle).toBe("object");
    clearInterval(handle);
  });
});
