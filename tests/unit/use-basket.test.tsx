/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBasket } from "../../src/hooks/use-basket.js";
import { AuthProvider } from "../../src/lib/auth.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mockStorage[k] ?? null,
  setItem: (k: string, v: string) => {
    mockStorage[k] = v;
  },
  removeItem: (k: string) => {
    delete mockStorage[k];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useBasket (Sprint 4 — warehouse w lookupProduct)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  it("sends warehouse in body to /api/scan (Sprint 4 fix)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        found: true,
        barcode: "5901234567890",
        products: [{ productId: 1, name: "Test Product", stocks: [{ quantity: 10 }] }],
      }),
    });

    // Pre-seed auth with warehouse
    mockStorage["pomagier_auth"] = JSON.stringify({
      user: { id: "u1", subiektUzId: 1, role: "operator" },
      operatorName: "Jan",
      warehouse: { id: 5, symbol: "MAG" },
    });

    const { result } = renderHook(() => useBasket(), { wrapper });

    await act(async () => {
      await result.current.addToBasket("5901234567890");
    });

    // Wait for the async lookupProduct to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/scan",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "5901234567890", warehouse: 5 }),
      }),
    );
  });

  it("sends warehouse undefined when not selected (graceful fallback)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });

    // No warehouse in auth (admin or stale session)
    mockStorage["pomagier_auth"] = JSON.stringify({
      user: { id: "admin", subiektUzId: 1, role: "admin" },
      operatorName: "Admin",
      warehouse: null,
    });

    const { result } = renderHook(() => useBasket(), { wrapper });

    await act(async () => {
      await result.current.addToBasket("5901234567890");
    });
    await new Promise((r) => setTimeout(r, 50));

    // warehouse undefined is sent (will be accepted by /api/scan for admin, rejected for operator)
    const callBody = mockFetch.mock.calls[0]?.[1]?.body;
    expect(callBody).toBe(JSON.stringify({ code: "5901234567890", warehouse: undefined }));
  });

  it("preserves existing basket item quantity when adding same code", async () => {
    // No fetch needed — re-adding increments locally
    mockFetch.mockClear();
    const { result } = renderHook(() => useBasket(), { wrapper });

    // First add: triggers lookupProduct (mockFetch called once)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        found: true,
        products: [{ productId: 1, name: "Test", stocks: [] }],
      }),
    });
    await act(async () => {
      await result.current.addToBasket("TEST123");
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second add: duplicate — no new lookup
    mockFetch.mockClear();
    await act(async () => {
      await result.current.addToBasket("TEST123");
    });
    expect(mockFetch).not.toHaveBeenCalled();

    expect(result.current.basket).toHaveLength(1);
    expect(result.current.basket[0].qty).toBe(2);
  });
});
