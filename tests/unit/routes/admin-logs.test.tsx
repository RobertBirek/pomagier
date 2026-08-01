/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockSearchState: { value: Record<string, unknown> } = { value: {} };
const mockNavigateFn = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    createFileRoute: (_path: string) => (options: { component: unknown }) => ({
      options,
      useSearch: () => mockSearchState.value,
      useNavigate: () => mockNavigateFn,
    }),
  };
});

vi.mock("../../../src/lib/api", () => ({
  getWarehouses: vi.fn(() => Promise.resolve([])),
}));

beforeEach(() => {
  mockSearchState.value = {};
  mockNavigateFn.mockReset();
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          rows: [],
          total: 0,
          page: 1,
          pageSize: 50,
          stats: { byCategory: {}, byMethod: {} },
        }),
    }),
  ) as unknown as typeof fetch;
});

describe("admin/logs route — correlation search param", () => {
  function renderRoute() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return import("../../../src/routes/admin.logs").then(({ Route }) => {
      const Component = (Route as unknown as { options: { component: React.ComponentType } })
        .options.component;
      return render(
        <QueryClientProvider client={qc}>
          <Component />
        </QueryClientProvider>,
      );
    });
  }

  it("shows no correlation chip when ?correlation is absent", async () => {
    mockSearchState.value = {};
    await renderRoute();
    await waitFor(() => {
      expect(screen.queryByText(/Correlation:/)).not.toBeInTheDocument();
    });
  });

  it("applies ?correlation=abc-123 to filter state and shows chip", async () => {
    mockSearchState.value = { correlation: "abc-123" };
    await renderRoute();
    await waitFor(() => {
      expect(screen.getByText(/Correlation: abc-123/)).toBeInTheDocument();
    });
  });

  it("clears the correlation filter when X on chip is clicked", async () => {
    mockSearchState.value = { correlation: "abc-123" };
    await renderRoute();
    const chip = await waitFor(() => screen.getByTestId("correlation-chip"));
    const clearBtn = chip.querySelector("button");
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn!);
    await waitFor(() => {
      expect(screen.queryByTestId("correlation-chip")).not.toBeInTheDocument();
    });
  });
});
