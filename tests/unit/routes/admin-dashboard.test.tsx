/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../src/lib/use-status", () => ({
  useMssqlStatus: vi.fn(() => ({ online: true, latencyMs: 0 })),
}));

vi.mock("../../../src/lib/api", () => ({
  getStats: vi.fn(() => Promise.resolve({ products: 5, warehouses: 2, users: 3 })),
  getCompany: vi.fn(() =>
    Promise.resolve({ name: "TestCo", nip: "1234567890", regon: "098765432" }),
  ),
  healthCheck: vi.fn(),
}));

describe("admin/dashboard route", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ movements: [], scans: [], dailyStats: [] }),
      }),
    );
  });

  it("renders without crash", async () => {
    const { Route } = await import("../../../src/routes/admin.dashboard");
    const Component = (Route as Record<string, unknown>).options.component;

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <Component />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("TestCo")).toBeInTheDocument();
    });
  });
});
