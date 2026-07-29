/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MapGrid } from "../../../src/components/admin/MapGrid";
import type { VerifyResult } from "../../../src/routes/admin.map";

const mockUseMapData = vi.hoisted(() => vi.fn());

vi.mock("../../../src/hooks/use-map-data", () => ({
  useMapData: mockUseMapData,
  heatColor: (q: number, m: number) => {
    if (q === 0) return "bg-muted/30";
    return "bg-green-100";
  },
}));

function defaultData() {
  const setSelected = vi.fn();
  return {
    grid: {
      A: {
        maxAisle: 2,
        maxShelf: 3,
        grid: {
          1: { 1: { code: "A-1-1-1", shelf: 1, productCount: 2, totalQuantity: 10 } },
        },
      },
    },
    emptyLocs: [{ code: "A-2-3-1", area: "A", aisle: 2, rack: 3, shelf: 1, label: "" }],
    isLoading: false,
    area: "A",
    setArea: vi.fn(),
    search: "",
    setSearch: vi.fn(),
    areaData: {
      maxAisle: 2,
      maxShelf: 3,
      grid: { 1: { 1: { code: "A-1-1-1", shelf: 1, productCount: 2, totalQuantity: 10 } } },
    },
    areas: ["A"],
    maxQty: 10,
    searchLower: "",
    cellDetail: null,
    setCellDetail: vi.fn(),
    loadingCell: false,
    verifyResult: null as VerifyResult | null,
    setVerifyResult: vi.fn(),
    selectedProducts: new Set<number>(),
    setSelectedProducts: setSelected,
    handleCellClick: vi.fn(),
    handlePrintLabels: vi.fn(),
    totalLocs: 1,
    totalProducts: 2,
    totalQty: 10,
    importMut: { mutate: vi.fn(), isPending: false },
    syncMut: { mutate: vi.fn(), isPending: false },
    verifyMut: { mutate: vi.fn(), isPending: false },
    fixMut: { mutate: vi.fn(), isPending: false },
    subiektMut: { mutate: vi.fn(), isPending: false },
    clearMut: { mutate: vi.fn(), isPending: false },
    batchMut: { mutate: vi.fn(), isPending: false },
  };
}

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MapGrid", () => {
  it("renders the title", () => {
    mockUseMapData.mockReturnValue(defaultData());
    renderWithClient(<MapGrid data={defaultData()} />);
    expect(screen.getByText("Mapa magazynu")).toBeInTheDocument();
  });

  it("renders area tabs", () => {
    mockUseMapData.mockReturnValue(defaultData());
    renderWithClient(<MapGrid data={defaultData()} />);
    expect(screen.getByText("Obszar A")).toBeInTheDocument();
  });

  it("shows loading row when loading", () => {
    const d = defaultData();
    d.isLoading = true;
    mockUseMapData.mockReturnValue(d);
    renderWithClient(<MapGrid data={d} />);
    expect(screen.getByText("Ładowanie…")).toBeInTheDocument();
  });
});
