/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../../../src/lib/auth";
import { MobileShell } from "../../../src/components/pomagier/MobileShell";

vi.mock("../../../src/lib/use-status", () => ({
  useMssqlStatus: vi.fn(() => ({ online: true, latencyMs: 0 })),
}));

vi.mock("../../../src/lib/use-dark", () => ({
  useDarkMode: vi.fn(() => [false, vi.fn()] as const),
}));

vi.mock("../../../src/lib/use-auto-logout", () => ({
  useAutoLogout: vi.fn(),
}));

vi.mock("../../../src/lib/offline-queue", () => ({
  getQueueCount: vi.fn(() => Promise.resolve(0)),
}));

vi.mock("@tanstack/react-router", () => {
  return {
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to} data-testid="link">
        {children}
      </a>
    ),
    Outlet: () => <div data-testid="outlet">Outlet</div>,
    useRouterState: ({ select }: { select?: (s: any) => any } = {}) => {
      const state = { location: { pathname: "/mobile/dashboard" } };
      if (select) return select(state);
      return state;
    },
    useNavigate: () => vi.fn(),
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>,
  );
}

describe("MobileShell", () => {
  it("renders without crash", () => {
    renderWithProviders(<MobileShell />);
    expect(screen.getAllByText("Start").length).toBeGreaterThanOrEqual(1);
  });
});
