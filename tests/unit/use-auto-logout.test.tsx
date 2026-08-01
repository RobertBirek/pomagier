/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock Auth context
const mockLogout = vi.fn();
let mockUser: { id: string; role: string } | null = { id: "u1", role: "operator" };
vi.mock("../../src/lib/auth.js", () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));

// Mock router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import { useAutoLogout } from "../../src/lib/use-auto-logout.js";

describe("useAutoLogout (Sprint 5 — context-aware redirectTo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUser = { id: "u1", role: "operator" };
  });

  it("redirects to /admin/login for admin (30 min idle)", () => {
    renderHook(() => useAutoLogout(30, "/admin/login"));
    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/admin/login" });
  });

  it("redirects to /mobile/login for operator (15 min idle)", () => {
    renderHook(() => useAutoLogout(15, "/mobile/login"));
    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/mobile/login" });
  });

  it("does NOT redirect if user is null", () => {
    mockUser = null;
    renderHook(() => useAutoLogout(1, "/admin/login"));
    vi.advanceTimersByTime(60_000);

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("resets timer on user activity (click)", () => {
    renderHook(() => useAutoLogout(1, "/admin/login"));

    vi.advanceTimersByTime(30_000);
    document.dispatchEvent(new Event("click"));
    vi.advanceTimersByTime(30_000); // 60s total, but reset

    expect(mockLogout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000); // now 90s total, 30s since last reset
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
