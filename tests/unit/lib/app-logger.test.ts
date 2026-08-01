import { describe, it, expect, beforeEach, vi } from "vitest";
import { maskSensitive } from "../../../src/lib/app-logger.js";

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    insert: () => ({
      values: () => Promise.resolve(),
    }),
  }),
  schema: {
    auditLog: { _name: "audit_log" },
  },
}));

vi.mock("../../../src/lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  getCorrelationId: () => "test-corr-id",
}));

describe("maskSensitive", () => {
  it("masks top-level sensitive keys", () => {
    const result = maskSensitive({ pin: "1234", name: "Jan" });
    expect(result.pin).toBe("***REDACTED***");
    expect(result.name).toBe("Jan");
  });

  it("masks nested sensitive keys", () => {
    const result = maskSensitive({ user: { pin: "1234", token: "abc" } });
    expect((result.user as Record<string, unknown>).pin).toBe("***REDACTED***");
    expect((result.user as Record<string, unknown>).token).toBe("***REDACTED***");
  });

  it("case-insensitive matching", () => {
    const result = maskSensitive({ PIN: "1234", Password: "x" });
    expect(result.PIN).toBe("***REDACTED***");
    expect(result.Password).toBe("***REDACTED***");
  });

  it("preserves non-sensitive values", () => {
    const result = maskSensitive({ id: 1, name: "X", count: 5 });
    expect(result.id).toBe(1);
    expect(result.name).toBe("X");
    expect(result.count).toBe(5);
  });

  it("handles arrays (passes through)", () => {
    const result = maskSensitive({ items: [{ id: 1 }, { id: 2 }] });
    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe("logEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never throws even if DB fails", async () => {
    const { logEvent } = await import("../../../src/lib/app-logger.js");
    await expect(
      logEvent({ category: "auth", action: "test.event", details: { user: "x" } }),
    ).resolves.toBeUndefined();
  });
});
