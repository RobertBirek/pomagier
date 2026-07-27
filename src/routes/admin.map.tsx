import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KpiCard, SectionTitle, LoadingRow, ErrorState, StatusBadge } from "@/components/pomagier/primitives";
import { MapPin, Package, Layers, Download, RefreshCw, Search, Box, X, Printer } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

interface CellData { code: string; shelf: number; productCount: number; totalQuantity: number; }
interface GridData { [area: string]: { maxAisle: number; maxShelf: number; grid: { [aisle: number]: { [shelf: number]: CellData } } } }

async function fetchGrid() { const r = await fetch("/api/locations/grid"); return r.json() as Promise<GridData>; }
async function fetchEmpty() { const r = await fetch("/api/locations/empty"); return r.json() as Promise<{ code: string; area: string; aisle: number; rack: number; shelf: number; label: string }[]>; }
async function fetchCellProducts(location: string) { const r = await fetch(`/api/products-by-location?location=${encodeURIComponent(location)}`); return r.json(); }
async function importLocations() { const r = await fetch("/api/locations/import", { method: "POST" }); if (!r.ok) throw new Error((await r.json()).error); return r.json(); }
async function syncProductLocations() { const r = await fetch("/api/locations/sync", { method: "POST" }); if (!r.ok) throw new Error((await r.json()).error); return r.json(); }

function heatColor(totalQuantity: number, maxQty: number): string {
  if (totalQuantity === 0) return "bg-muted/30 hover:bg-muted/50";
  const ratio = Math.min(totalQuantity / Math.max(maxQty, 1), 1);
  if (ratio < 0.2) return "bg-green-100 hover:bg-green-200 text-green-900";
  if (ratio < 0.4) return "bg-green-200 hover:bg-green-300 text-green-900";
  if (ratio < 0.6) return "bg-yellow-100 hover:bg-yellow-200 text-yellow-900";
  if (ratio < 0.8) return "bg-orange-200 hover:bg-orange-300 text-orange-900";
  return "bg-red-200 hover:bg-red-300 text-red-900";
}

export const Route = createFileRoute("/admin/map")({ component: AdminMap });

function AdminMap() {
  const qc = useQueryClient();
  const { data: grid, isLoading } = useQuery({ queryKey: ["grid"], queryFn: fetchGrid });
  const { data: emptyLocs } = useQuery({ queryKey: ["empty-locs"], queryFn: fetchEmpty });
  const [area, setArea] = useState("A");
  const [search, setSearch] = useState("");
  const [cellDetail, setCellDetail] = useState<{ code: string; products: any[] } | null>(null);
  const [loadingCell, setLoadingCell] = useState(false);

  const importMut = useMutation({ mutationFn: importLocations, onSuccess: (d: any) => { toast.success(`Import: ${d.imported} lokalizacji`); qc.invalidateQueries(); }, onError: (e: any) => toast.error(e.message) });
  const syncMut = useMutation({ mutationFn: syncProductLocations, onSuccess: (d: any) => toast.success(`Sync: ${d.inserted} powiązań`), onError: (e: any) => toast.error(e.message) });
  const areaData = grid?.[area];
  const areas = grid ? Object.keys(grid).sort() : [];

  // Compute max quantity for heat map
  const maxQty = useMemo(() => {
    if (!areaData) return 1;
    let max = 1;
    for (const aisle of Object.values(areaData.grid)) {
      for (const cell of Object.values(aisle)) {
        if (cell.totalQuantity > max) max = cell.totalQuantity;
      }
    }
    return max;
  }, [areaData]);

  // Highlight matches from search
  const searchLower = search.toLowerCase().trim();

  const handleCellClick = async (code: string) => {
    setLoadingCell(true); setCellDetail({ code, products: [] });
    const prods = await fetchCellProducts(code);
    setCellDetail({ code, products: prods });
    setLoadingCell(false);
  };

  const handlePrintLabels = () => {
    if (!areaData) return;
    const codes: string[] = [];
    for (const aisle of Object.values(areaData.grid)) {
      for (const cell of Object.values(aisle)) {
        if (cell.productCount > 0) codes.push(cell.code);
      }
    }
    if (codes.length === 0) { toast.error("Brak lokalizacji z towarami"); return; }
    fetch(`/api/locations/export-pdf?codes=${codes.join(",")}`).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }).catch(() => toast.error("Błąd eksportu"));
  };

  // Compute totals
  const totalLocs = areaData ? Object.values(areaData.grid).reduce((s, a) => s + Object.keys(a).length, 0) : 0;
  const totalProducts = areaData ? Object.values(areaData.grid).reduce((s, a) => s + Object.values(a).reduce((ss, c) => ss + c.productCount, 0), 0) : 0;
  const totalQty = areaData ? Object.values(areaData.grid).reduce((s, a) => s + Object.values(a).reduce((ss, c) => ss + c.totalQuantity, 0), 0) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mapa magazynu</h1>
        <p className="text-sm text-muted-foreground">Wizualizacja lokalizacji z ilościami towarów</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => importMut.mutate()} disabled={importMut.isPending} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50"><Download className="h-3.5 w-3.5" />Import</button>
        <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />Sync</button>
        <button onClick={handlePrintLabels} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs hover:bg-accent"><Printer className="h-3.5 w-3.5" />Etykiety</button>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj towaru..." className="w-48 rounded-md border bg-background py-1.5 pl-8 pr-3 text-xs" />
        </div>
      </div>

      {/* Area tabs */}
      <div className="flex gap-1 border-b">
        {areas.map(a => (
          <button key={a} onClick={() => setArea(a)} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${area === a ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            Obszar {a}
          </button>
        ))}
      </div>

      {isLoading && <LoadingRow />}

      {/* Grid + sidebar layout */}
      <div className="flex gap-4">
        {/* Main grid */}
        <div className="flex-1 min-w-0">
          {areaData ? (
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                  <th className="sticky left-0 bg-background px-2 py-1 text-left font-medium text-muted-foreground border-b">Alejka \ Półka</th>
                  {Array.from({ length: areaData.maxShelf }, (_, i) => i + 1).map(s => (
                    <th key={s} className="px-2 py-1 text-center font-medium text-muted-foreground border-b min-w-[2.5rem]">{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: areaData.maxAisle }, (_, i) => i + 1).map(aisle => (
                    <tr key={aisle}>
                      <td className="sticky left-0 bg-background px-2 py-1 font-semibold text-muted-foreground border-r">{aisle}</td>
                      {Array.from({ length: areaData.maxShelf }, (_, j) => j + 1).map(shelf => {
                        const cell = areaData.grid[aisle]?.[shelf];
                        const empty = !cell || cell.productCount === 0;
                        const highlight = !empty && searchLower && cell.code.toLowerCase().includes(searchLower);
                        return (
                          <td key={shelf} className="p-0.5">
                            <button
                              onClick={() => cell && handleCellClick(cell.code)}
                              disabled={empty}
                              title={cell ? `${cell.code} — ${cell.totalQuantity} szt.` : `A ${aisle}-?-${shelf}-1 (pusta)`}
                              className={`w-full rounded py-1.5 text-center font-mono font-semibold transition-colors touch-target ${empty ? "bg-muted/30 text-muted-foreground/30 cursor-default" : heatColor(cell!.totalQuantity, maxQty)} ${highlight ? "ring-2 ring-primary ring-offset-1" : ""}`}
                            >
                              {cell?.totalQuantity || ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !isLoading && <ErrorState title="Brak danych" description="Uruchom import i synchronizację" />
          )}
        </div>

        {/* Sidebar: empty locations */}
        <div className="hidden lg:block w-64 shrink-0">
          <div className="rounded-lg border bg-card p-3 sticky top-4">
            <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><Box className="h-4 w-4 text-muted-foreground" />Wolne lokalizacje</div>
            {emptyLocs && emptyLocs.filter(l => l.area === area).length > 0 ? (
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {emptyLocs.filter(l => l.area === area).map(l => (
                  <div key={l.code} className="text-xs font-mono text-muted-foreground py-0.5">{l.code}</div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Brak wolnych w obszarze {area}</p>
            )}
            {emptyLocs && <p className="text-xs text-muted-foreground mt-2">Wszystkie: {emptyLocs.length}</p>}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Obszarów" value={String(areas.length)} icon={<Layers className="h-4 w-4" />} tone="primary" />
        <KpiCard label="Lokalizacji" value={String(totalLocs)} icon={<MapPin className="h-4 w-4" />} tone="success" />
        <KpiCard label="Towarów" value={String(totalProducts)} icon={<Package className="h-4 w-4" />} tone="info" />
        <KpiCard label="Sztuk" value={String(totalQty)} icon={<Package className="h-4 w-4" />} tone="warning" />
      </div>

      {/* Cell detail modal */}
      {cellDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCellDetail(null)}>
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{cellDetail.code}</h2>
                <p className="text-xs text-muted-foreground">{cellDetail.products.length} produktów</p>
              </div>
              <button onClick={() => setCellDetail(null)} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            {loadingCell ? (
              <LoadingRow />
            ) : cellDetail.products.length > 0 ? (
              <div className="space-y-2">
                {cellDetail.products.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded border bg-muted/20 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-semibold">{p.symbol}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.name}</div>
                      {p.barcode && <div className="text-xs text-muted-foreground font-mono">EAN: {p.barcode}</div>}
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-xs text-muted-foreground">{p.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Brak produktów w tej lokalizacji</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
