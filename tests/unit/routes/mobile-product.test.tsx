/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../src/routes/mobile.product.$code", async (importOriginal) => {
  const mod = await importOriginal();
  mod.Route.useParams = vi.fn(() => ({ code: "5901234567890" }));
  return mod;
});

describe("mobile/product route", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            found: true,
            products: [{ productId: 1, name: "Test", symbol: "TST" }],
          }),
      }),
    );
  });

  it("renders without crash", async () => {
    const { Route } = await import("../../../src/routes/mobile.product.$code");
    const Component = (Route as Record<string, unknown>).options.component;

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <Component />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Ładowanie…")).toBeInTheDocument();
  });
});
