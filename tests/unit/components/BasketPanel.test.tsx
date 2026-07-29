/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BasketPanel } from "../../../src/components/pomagier/BasketPanel";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("BasketPanel", () => {
  it("renders without crash with items", () => {
    const items = [
      { code: "5901234567890", name: "Test Product", qty: 1 },
    ];
    renderWithClient(
      <BasketPanel
        items={items}
        totalQty={1}
        onUpdateQty={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText(/Koszyk/)).toBeInTheDocument();
  });

  it("returns null when items are empty", () => {
    const { container } = renderWithClient(
      <BasketPanel
        items={[]}
        totalQty={0}
        onUpdateQty={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
