import { describe, it, expect, beforeEach, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const deleteFn = vi.fn();
  return {
    delete: deleteFn,
    where: vi.fn(),
  };
});

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    delete: dbMocks.delete,
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

describe("runCleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.delete.mockReset();
    dbMocks.where.mockReset();
  });

  it("deletes rows older than 30 days from both tables", async () => {
    dbMocks.delete
      .mockReturnValueOnce({ where: dbMocks.where })
      .mockReturnValueOnce({ where: dbMocks.where });
    dbMocks.where.mockResolvedValueOnce({ rowCount: 5 }).mockResolvedValueOnce({ rowCount: 5 });

    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    const result = await runCleanup();

    expect(dbMocks.delete).toHaveBeenCalledTimes(2);
    expect(result.auditDeleted).toBe(5);
    expect(result.movementsDeleted).toBe(5);
  });

  it("returns 0 when no rows match", async () => {
    dbMocks.delete
      .mockReturnValueOnce({ where: dbMocks.where })
      .mockReturnValueOnce({ where: dbMocks.where });
    dbMocks.where.mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({ rowCount: 0 });

    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    const result = await runCleanup();

    expect(result.auditDeleted).toBe(0);
    expect(result.movementsDeleted).toBe(0);
  });

  it("handles null rowCount (defensive)", async () => {
    dbMocks.delete
      .mockReturnValueOnce({ where: dbMocks.where })
      .mockReturnValueOnce({ where: dbMocks.where });
    dbMocks.where
      .mockResolvedValueOnce({ rowCount: null })
      .mockResolvedValueOnce({ rowCount: null });

    const { runCleanup } = await import("../../../src/lib/cleanup.js");
    const result = await runCleanup();

    expect(result.auditDeleted).toBe(0);
    expect(result.movementsDeleted).toBe(0);
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
