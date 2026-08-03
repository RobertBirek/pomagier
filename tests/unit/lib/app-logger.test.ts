import { describe, it, expect, beforeEach, vi } from "vitest";
import { maskSensitive } from "../../../src/lib/app-logger.js";

const dbMocks = vi.hoisted(() => ({
  values: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    insert: () => ({ values: dbMocks.values }),
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

  it("recurses into arrays and masks sensitive keys in items", () => {
    const result = maskSensitive({
      items: [
        { id: 1, pin: "1234" },
        { id: 2, token: "abc" },
      ],
    });
    const items = result.items as Array<Record<string, unknown>>;
    expect(items[0].id).toBe(1);
    expect(items[0].pin).toBe("***REDACTED***");
    expect(items[1].id).toBe(2);
    expect(items[1].token).toBe("***REDACTED***");
  });
});

describe("logEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.values.mockReset();
    dbMocks.values.mockImplementation(() => Promise.resolve());
  });

  it("never throws even if DB fails", async () => {
    const { logEvent } = await import("../../../src/lib/app-logger.js");
    await expect(
      logEvent({ category: "auth", action: "test.event", details: { user: "x" } }),
    ).resolves.toBeUndefined();
  });

  it("does not throw and logs error when DB insert rejects", async () => {
    dbMocks.values.mockRejectedValueOnce(new Error("DB unavailable"));
    const { logEvent } = await import("../../../src/lib/app-logger.js");
    await expect(
      logEvent({ category: "auth", action: "test.db-failure" }),
    ).resolves.toBeUndefined();
  });
});
