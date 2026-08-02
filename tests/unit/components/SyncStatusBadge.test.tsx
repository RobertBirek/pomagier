/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SyncStatusBadge } from "../../../src/components/admin/SyncStatusBadge";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function renderWithClient(onSyncComplete: () => void = () => {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <SyncStatusBadge onSyncComplete={onSyncComplete} />
    </QueryClientProvider>,
  );
}

describe("SyncStatusBadge", () => {
  it("renders null while data is loading", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { container } = renderWithClient();
    expect(container.firstChild).toBeNull();
  });

  it("shows green 'Zsynchronizowane' badge when count is 0", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        since: "2026-08-01T00:00:00Z",
        newSince: "2026-08-02T00:00:00Z",
        count: 0,
        products: [],
      }),
    });
    renderWithClient();
    await waitFor(() => {
      expect(screen.getByText(/Zsynchronizowane z Subiekt/)).toBeInTheDocument();
    });
  });

  it("shows amber warning with count and Sync button when changes detected", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        since: "2026-08-01T00:00:00Z",
        newSince: "2026-08-02T00:00:00Z",
        count: 3,
        products: [
          {
            productId: 1,
            symbol: "P1",
            name: "Prod 1",
            subiektCodes: ["A 1-2-3-4"],
            subiektModifiedAt: "2026-08-02T00:00:00Z",
          },
          {
            productId: 2,
            symbol: "P2",
            name: "Prod 2",
            subiektCodes: ["B 1-2-3-4"],
            subiektModifiedAt: "2026-08-01T12:00:00Z",
          },
          {
            productId: 3,
            symbol: "P3",
            name: "Prod 3",
            subiektCodes: ["C 1-2-3-4"],
            subiektModifiedAt: "2026-08-01T06:00:00Z",
          },
        ],
      }),
    });
    renderWithClient();
    await waitFor(() => {
      expect(screen.getByText(/3 produktów zmienionych w Subiekcie/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Sync teraz/ })).toBeInTheDocument();
  });

  it("calls fix-sync-batch with all productIds when Sync button clicked", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          since: "2026-08-01T00:00:00Z",
          newSince: "2026-08-02T00:00:00Z",
          count: 2,
          products: [
            {
              productId: 10,
              symbol: "X",
              name: "X",
              subiektCodes: ["A 1-2-3-4"],
              subiektModifiedAt: "2026-08-02T00:00:00Z",
            },
            {
              productId: 20,
              symbol: "Y",
              name: "Y",
              subiektCodes: ["B 1-2-3-4"],
              subiektModifiedAt: "2026-08-01T12:00:00Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, imported: 2 }),
      });

    renderWithClient();
    const btn = await waitFor(() => screen.getByRole("button", { name: /Sync teraz/ }));
    btn.click();
    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find((c) => c[1] && c[1].method === "POST");
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall![1].body as string);
      expect(body.productIds).toEqual([10, 20]);
      expect(body.direction).toBe("subiekt-to-postgres");
    });
  });
});
