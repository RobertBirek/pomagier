import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import {
  KpiCard,
  StatusBadge,
  SectionTitle,
  LoadingRow,
  ErrorState,
  EmptyState,
} from "@/components/pomagier/primitives";
import { Package, Search, ChevronLeft, ChevronRight, Barcode, MapPin } from "lucide-react";

interface ProductRow {
  id: number;
  symbol: string;
  name: string;
  barcode: string;
  unit: string;
  description: string;
  stock: number;
  reserved: number;
  locations: string[];
}

interface ProductsResponse {
  rows: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function fetchProducts(params: {
  page: number;
  pageSize: number;
  search: string;
  warehouseId: number;
}) {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    search: params.search,
    warehouseId: String(params.warehouseId),
  });
  const res = await fetch(`/api/products?${qs}`);
  return res.json() as Promise<ProductsResponse>;
}

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

function AdminProducts() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["products", page, pageSize, search],
    queryFn: () => fetchProducts({ page, pageSize, search, warehouseId: 0 }),
    placeholderData: (prev) => prev,
  });

  const handleSearch = useCallback(() => {
    setPage(1);
    setSearch(searchInput);
  }, [searchInput]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Towary</h1>
        <p className="text-sm text-muted-foreground">Kartoteki towarowe z Subiekt GT (tw__Towar)</p>
      </div>

      {/* Search & pagination bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Szukaj po symbolu, nazwie, EAN..."
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Szukaj
          </button>
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(1);
              }}
              className="text-xs text-muted-foreground underline"
            >
              Wyczyść
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{total.toLocaleString()} towarów</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setPage(1);
            }}
            className="rounded border bg-background px-2 py-1 text-xs"
          >
            {[20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n} / strona
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading && <LoadingRow />}
      {error && <ErrorState title="Błąd" description="Nie udało się pobrać towarów" />}

      {!isLoading && rows.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium w-12">ID</th>
                <th className="px-4 py-2 text-left font-medium">Symbol</th>
                <th className="px-4 py-2 text-left font-medium">Nazwa</th>
                <th className="px-4 py-2 text-left font-medium hidden sm:table-cell">EAN</th>
                <th className="px-4 py-2 text-left font-medium hidden md:table-cell">
                  Lokalizacja
                </th>
                <th className="px-4 py-2 text-left font-medium">JM</th>
                <th className="px-4 py-2 text-right font-medium">Stan</th>
                <th className="px-4 py-2 text-right font-medium hidden sm:table-cell">Rez.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.id}</td>
                  <td className="px-4 py-2 font-mono text-xs font-semibold">{row.symbol}</td>
                  <td className="px-4 py-2 max-w-[200px] truncate" title={row.name}>
                    {row.name}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                    {row.barcode ? (
                      <span className="inline-flex items-center gap-1">
                        <Barcode className="h-3 w-3" />
                        {row.barcode}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 hidden md:table-cell">
                    {row.locations && row.locations.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.locations.map((loc) => (
                          <span
                            key={loc}
                            className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-mono"
                          >
                            <MapPin className="h-3 w-3" />
                            {loc}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs">{row.unit}</td>
                  <td className="px-4 py-2 text-right font-semibold font-mono">{row.stock}</td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground font-mono hidden sm:table-cell">
                    {row.reserved || "0"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && rows.length === 0 && !error && (
        <EmptyState
          title="Brak towarów"
          description={search ? `Brak wyników dla "${search}"` : "Baza Subiekt GT jest pusta"}
        />
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Strona {page} z {data.totalPages} ({total.toLocaleString()} towarów)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="touch-target rounded border px-3 py-1.5 hover:bg-accent disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {generatePageNumbers(page, data.totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="px-2 py-1.5 text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`touch-target min-w-[2rem] rounded border px-2 py-1.5 ${
                    p === page ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="touch-target rounded border px-3 py-1.5 hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Smart pagination numbers: 1 ... 4 5 [6] 7 8 ... 20 */
function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
