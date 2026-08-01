/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock Auth context
const mockLogout = vi.fn();
const mockAuthValue = { user: { id: "u1", role: "admin" }, logout: mockLogout };
vi.mock("../../src/lib/auth.js", () => ({
  useAuth: () => mockAuthValue,
}));

// Mock router
const mockNavigate = vi.fn();
let mockPathname = "/admin/dashboard";
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useRouterState: (options?: {
    select?: (state: { location: { pathname: string } }) => unknown;
  }) => {
    const state = { location: { pathname: mockPathname } };
    return options?.select ? options.select(state) : state;
  },
}));

// Mock query client
const mockQueryCache = {
  subscribe: vi.fn(),
  clear: vi.fn(),
};
const mockQueryClient = {
  getQueryCache: () => mockQueryCache,
  clear: mockQueryCache.clear,
};
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
}));

import { use401Redirect } from "../../src/lib/use-401-redirect.js";

describe("use401Redirect (Sprint 5)", () => {
  let subscriberCallback: (event: {
    type: string;
    query: { state: { status: string; error: Error | null } };
  }) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/admin/dashboard";
    subscriberCallback = vi.fn();
    mockQueryCache.subscribe.mockImplementation((cb) => {
      subscriberCallback = cb;
      return () => {};
    });
  });

  it("subscribes to QueryCache on mount", () => {
    renderHook(() => use401Redirect("/admin/login"));
    expect(mockQueryCache.subscribe).toHaveBeenCalledTimes(1);
  });

  it("redirects on HTTP 401 error from any query", () => {
    renderHook(() => use401Redirect("/admin/login"));

    act(() => {
      subscriberCallback({
        type: "updated",
        query: { state: { status: "error", error: new Error("HTTP 401") } },
      });
    });

    expect(mockQueryCache.clear).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/login" });
  });

  it("does NOT redirect on non-401 errors", () => {
    renderHook(() => use401Redirect("/admin/login"));

    act(() => {
      subscriberCallback({
        type: "updated",
        query: { state: { status: "error", error: new Error("HTTP 500") } },
      });
    });

    expect(mockQueryCache.clear).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does NOT redirect when already on the login page (prevents loop)", () => {
    mockPathname = "/admin/login";
    renderHook(() => use401Redirect("/admin/login"));

    // Even if 401 occurs, no redirect
    act(() => {
      subscriberCallback({
        type: "updated",
        query: { state: { status: "error", error: new Error("HTTP 401") } },
      });
    });

    expect(mockQueryCache.clear).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("does NOT redirect on non-error updates (e.g. successful refetch)", () => {
    renderHook(() => use401Redirect("/admin/login"));

    act(() => {
      subscriberCallback({
        type: "updated",
        query: { state: { status: "success", error: null } },
      });
    });

    expect(mockQueryCache.clear).not.toHaveBeenCalled();
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount (no memory leak)", () => {
    const unsubscribe = vi.fn();
    mockQueryCache.subscribe.mockReturnValueOnce(unsubscribe);

    const { unmount } = renderHook(() => use401Redirect("/mobile/login"));
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
