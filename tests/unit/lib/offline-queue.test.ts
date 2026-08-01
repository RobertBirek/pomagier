/**
 * Sprint 8 — queue event logging
 * Tests that addScanToQueue and replayQueue emit logEvent calls.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const logEventMock = vi.hoisted(() =>
  vi.fn<(event: Record<string, unknown>) => Promise<void>>(() => Promise.resolve()),
);

vi.mock("../../../src/lib/app-logger.js", () => ({
  logEvent: logEventMock,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createFakeIDB() {
  const stores = new Map<string, Map<number, Record<string, unknown>>>();
  let nextId = 1;

  const buildStore = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;

    const makeSuccessReq = (result: unknown) => {
      const req: { result: unknown; onsuccess: null | (() => void); onerror: null } = {
        result,
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    };

    return {
      add: (item: Record<string, unknown>) => {
        const id = nextId++;
        store.set(id, { ...item, id });
        return { onsuccess: null, onerror: null } as { onsuccess: null; onerror: null };
      },
      delete: (id: number) => {
        store.delete(id);
        return { onsuccess: null, onerror: null } as { onsuccess: null; onerror: null };
      },
      clear: () => {
        store.clear();
        return { onsuccess: null, onerror: null } as { onsuccess: null; onerror: null };
      },
      count: () => makeSuccessReq(store.size),
      getAll: () => makeSuccessReq(Array.from(store.values())),
    };
  };

  const db = {
    transaction: (_storeName: string, _mode: string) => {
      const tx: {
        objectStore: (name: string) => ReturnType<typeof buildStore>;
        oncomplete: null | (() => void);
        onerror: null;
        onabort: null;
      } = {
        objectStore: (name: string) => buildStore(name),
        oncomplete: null,
        onerror: null,
        onabort: null,
      };
      queueMicrotask(() => {
        if (tx.oncomplete) tx.oncomplete();
      });
      return tx;
    },
    createObjectStore: (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      return {};
    },
    close: () => {},
  };

  return {
    open: (_name: string, _version: number) => {
      const req: {
        result: unknown;
        error: null;
        onsuccess: null | (() => void);
        onerror: null;
        onupgradeneeded: null | (() => void);
      } = {
        result: null,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => {
        req.result = db;
        if (req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
  };
}

let fakeIDB: ReturnType<typeof createFakeIDB>;

beforeEach(() => {
  fakeIDB = createFakeIDB();
  vi.stubGlobal("indexedDB", fakeIDB);
  logEventMock.mockReset();
  logEventMock.mockImplementation(() => Promise.resolve());
  mockFetch.mockReset();
});

describe("addScanToQueue — queue.added event (Sprint 8 T1)", () => {
  it("emits logEvent with action=queue.added on success", async () => {
    const { addScanToQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("ABC123");

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.category).toBe("queue");
    expect(event.action).toBe("queue.added");
    expect(event.method).toBe("mobile");
    expect(event.target).toEqual({ type: "scan", id: "ABC123" });
    expect(event.success).toBe(true);
  });

  it("includes location in details when provided", async () => {
    const { addScanToQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("ABC123", "A1-B2");

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.details).toEqual(expect.objectContaining({ location: "A1-B2" }));
  });

  it("includes warehouse in details when provided", async () => {
    const { addScanToQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("ABC123", undefined, 5);

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.details).toEqual(expect.objectContaining({ warehouse: 5 }));
  });
});

describe("replayQueue — queue.replayed_ok / queue.replayed_failed events (Sprint 8 T2)", () => {
  it("emits queue.replayed_ok on fetch success", async () => {
    const { addScanToQueue, replayQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("OK123");
    logEventMock.mockClear();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const result = await replayQueue();

    expect(result.ok).toBe(1);
    expect(result.failed).toBe(0);
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.category).toBe("queue");
    expect(event.action).toBe("queue.replayed_ok");
    expect(event.method).toBe("mobile");
    expect(event.target).toEqual({ type: "scan", id: "OK123" });
    expect(event.success).toBe(true);
    expect(typeof event.durationMs).toBe("number");
  });

  it("emits queue.replayed_failed on HTTP error with errorMessage", async () => {
    const { addScanToQueue, replayQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("FAIL500");
    logEventMock.mockClear();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const result = await replayQueue();

    expect(result.failed).toBe(1);
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.category).toBe("queue");
    expect(event.action).toBe("queue.replayed_failed");
    expect(event.method).toBe("mobile");
    expect(event.target).toEqual({ type: "scan", id: "FAIL500" });
    expect(event.success).toBe(false);
    expect(event.errorMessage).toContain("500");
    expect(typeof event.durationMs).toBe("number");
  });

  it("emits queue.replayed_failed on network error (fetch throws)", async () => {
    const { addScanToQueue, replayQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("NETERR");
    logEventMock.mockClear();

    mockFetch.mockRejectedValueOnce(new Error("NetworkError: when fetching"));

    const result = await replayQueue();

    expect(result.failed).toBe(1);
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.category).toBe("queue");
    expect(event.action).toBe("queue.replayed_failed");
    expect(event.method).toBe("mobile");
    expect(event.target).toEqual({ type: "scan", id: "NETERR" });
    expect(event.success).toBe(false);
    expect(event.errorMessage).toBeTruthy();
    expect((event.errorMessage as string).length).toBeGreaterThan(0);
  });
});

describe("replayQueue — queue.conflict on 409 (Sprint 9 T1)", () => {
  it("emits queue.conflict (NOT queue.replayed_failed) on HTTP 409", async () => {
    const { addScanToQueue, replayQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("DUP409", "A1-B2");
    logEventMock.mockClear();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Location already exists" }),
    });

    const result = await replayQueue();

    expect(result.failed).toBe(1);
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.category).toBe("queue");
    expect(event.action).toBe("queue.conflict");
    expect(event.method).toBe("mobile");
    expect(event.target).toEqual({ type: "scan", id: "DUP409" });
    expect(event.success).toBe(false);
    expect(event.errorMessage).toBe("Location already exists");
    expect(event.details).toEqual(expect.objectContaining({ httpStatus: 409, location: "A1-B2" }));
    expect(typeof event.durationMs).toBe("number");
  });

  it("emits queue.replayed_failed (NOT queue.conflict) on HTTP 500", async () => {
    const { addScanToQueue, replayQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("SRV500");
    logEventMock.mockClear();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const result = await replayQueue();

    expect(result.failed).toBe(1);
    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.action).toBe("queue.replayed_failed");
    expect(event.action).not.toBe("queue.conflict");
  });
});

describe("actorSubiektUzId threading in queue events (Sprint 9 T2)", () => {
  it("addScanToQueue passes actorSubiektUzId to queue.added", async () => {
    const { addScanToQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("ACTOR5", undefined, undefined, 5);

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.action).toBe("queue.added");
    expect(event.actorSubiektUzId).toBe(5);
  });

  it("addScanToQueue omits actorSubiektUzId when not provided", async () => {
    const { addScanToQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("ACTOR_NONE");

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.action).toBe("queue.added");
    expect(event.actorSubiektUzId).toBeUndefined();
  });

  it("replayQueue passes actorSubiektUzId to queue.replayed_ok", async () => {
    const { addScanToQueue, replayQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("REPLAY7");
    logEventMock.mockClear();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await replayQueue(7);

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.action).toBe("queue.replayed_ok");
    expect(event.actorSubiektUzId).toBe(7);
  });

  it("replayQueue passes actorSubiektUzId to queue.conflict on 409", async () => {
    const { addScanToQueue, replayQueue } = await import("../../../src/lib/offline-queue.js");
    await addScanToQueue("CONFLICT7", "A1-B2");
    logEventMock.mockClear();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Location already exists" }),
    });

    await replayQueue(7);

    expect(logEventMock).toHaveBeenCalledTimes(1);
    const event = logEventMock.mock.calls[0][0];
    expect(event.action).toBe("queue.conflict");
    expect(event.actorSubiektUzId).toBe(7);
  });
});
