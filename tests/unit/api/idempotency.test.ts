import { describe, it, expect, beforeEach, vi } from "vitest";

const logEventMock = vi.hoisted(() =>
  vi.fn<(event: Record<string, unknown>) => Promise<void>>(() => Promise.resolve()),
);

const dbMocks = vi.hoisted(() => {
  const deleteFn = vi.fn();
  const selectFn = vi.fn();
  return {
    delete: deleteFn,
    whereForDelete: vi.fn(),
    select: selectFn,
    from: vi.fn(),
    whereForSelect: vi.fn(),
  };
});

vi.mock("../../../src/db/index.js", () => ({
  getDb: () => ({
    delete: dbMocks.delete,
    select: dbMocks.select,
  }),
  schema: {
    idempotencyKeys: {
      key: "key",
      response: "response",
      statusCode: "status_code",
      expiresAt: "expires_at",
      createdAt: "created_at",
    },
  },
}));

vi.mock("../../../src/lib/app-logger.js", () => ({
  logEvent: logEventMock,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: "eq", col, val })),
  lt: vi.fn((col: unknown, val: unknown) => ({ op: "lt", col, val })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  logEventMock.mockReset();
  logEventMock.mockImplementation(() => Promise.resolve());
  dbMocks.delete.mockReset();
  dbMocks.whereForDelete.mockReset();
  dbMocks.select.mockReset();
  dbMocks.from.mockReset();
  dbMocks.whereForSelect.mockReset();
  dbMocks.delete.mockReturnValue({ where: dbMocks.whereForDelete });
  dbMocks.whereForDelete.mockResolvedValue(undefined);
  dbMocks.select.mockReturnValue({ from: dbMocks.from });
  dbMocks.from.mockReturnValue({ where: dbMocks.whereForSelect });
});

describe("checkIdempotency — idempotency.reused event (Sprint 8 T3)", () => {
  it("emits logEvent with action=idempotency.reused when key exists and is not expired", async () => {
    const future = new Date(Date.now() + 60_000);
    dbMocks.whereForSelect.mockResolvedValueOnce([
      {
        key: "KEY-EXISTS",
        response: JSON.stringify({ ok: true }),
        statusCode: 200,
        expiresAt: future,
      },
    ]);

    const { checkIdempotency } = await import("../../../src/api/idempotency.js");
    const result = await checkIdempotency("KEY-EXISTS");

    expect(result).toEqual({ result: { ok: true }, statusCode: 200 });
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.category).toBe("queue");
    expect(event.action).toBe("idempotency.reused");
    expect(event.method).toBe("web");
    expect(event.target).toEqual({ type: "idempotency", id: "KEY-EXISTS" });
    expect(event.success).toBe(true);
    expect(event.details).toEqual(expect.objectContaining({ reusedForResponse: { ok: true } }));
  });

  it("does not emit logEvent when key does not exist", async () => {
    dbMocks.whereForSelect.mockResolvedValueOnce([]);

    const { checkIdempotency } = await import("../../../src/api/idempotency.js");
    const result = await checkIdempotency("MISSING-KEY");

    expect(result).toBeNull();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("does not emit logEvent when key exists but is expired", async () => {
    const past = new Date(Date.now() - 60_000);
    dbMocks.whereForSelect.mockResolvedValueOnce([
      { key: "STALE-KEY", response: "{}", statusCode: 200, expiresAt: past },
    ]);

    const { checkIdempotency } = await import("../../../src/api/idempotency.js");
    const result = await checkIdempotency("STALE-KEY");

    expect(result).toBeNull();
    expect(logEventMock).not.toHaveBeenCalled();
  });

  it("threads actorSubiektUzId into logEvent when caller provides it (Sprint 10 T1)", async () => {
    const future = new Date(Date.now() + 60_000);
    dbMocks.whereForSelect.mockResolvedValueOnce([
      {
        key: "KEY-WITH-ACTOR",
        response: JSON.stringify({ ok: true }),
        statusCode: 200,
        expiresAt: future,
      },
    ]);

    const { checkIdempotency } = await import("../../../src/api/idempotency.js");
    const result = await checkIdempotency("KEY-WITH-ACTOR", 5);

    expect(result).toEqual({ result: { ok: true }, statusCode: 200 });
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.actorSubiektUzId).toBe(5);
  });

  it("leaves actorSubiektUzId undefined when caller omits it (backward compat, Sprint 10 T1)", async () => {
    const future = new Date(Date.now() + 60_000);
    dbMocks.whereForSelect.mockResolvedValueOnce([
      {
        key: "KEY-NO-ACTOR",
        response: JSON.stringify({ ok: true }),
        statusCode: 200,
        expiresAt: future,
      },
    ]);

    const { checkIdempotency } = await import("../../../src/api/idempotency.js");
    const result = await checkIdempotency("KEY-NO-ACTOR");

    expect(result).toEqual({ result: { ok: true }, statusCode: 200 });
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.actorSubiektUzId).toBeUndefined();
  });
});
