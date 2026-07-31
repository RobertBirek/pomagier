import { describe, it, expect, vi } from "vitest";

// Mock logger before importing the module under test
vi.mock("../../src/lib/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  withCorrelation: vi.fn((fn: () => unknown) => fn()),
  getCorrelationId: vi.fn(() => "test-correlation-id"),
}));

vi.mock("../../src/api/adapter-provider.js", () => ({ getAdapter: () => ({}) }));
vi.mock("../../src/db/index.js", () => ({
  getDb: () => ({}),
  schema: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
}));

describe("writeSubiektWithRetry", () => {
  it("succeeds on first attempt (no retry)", async () => {
    const { writeSubiektWithRetry } = await import("../../src/api/routes/locations.js");
    const fn = vi.fn().mockResolvedValue(undefined);
    await writeSubiektWithRetry(fn, "test-key");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on third attempt", async () => {
    const { writeSubiektWithRetry } = await import("../../src/api/routes/locations.js");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout 1"))
      .mockRejectedValueOnce(new Error("timeout 2"))
      .mockResolvedValueOnce(undefined);

    await writeSubiektWithRetry(fn, "test-key");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after 3 failed attempts", async () => {
    const { writeSubiektWithRetry } = await import("../../src/api/routes/locations.js");
    const fn = vi.fn().mockRejectedValue(new Error("permanent failure"));

    await expect(writeSubiektWithRetry(fn, "test-key")).rejects.toThrow("permanent failure");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
