import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KpiCard, SectionTitle, LoadingRow, ErrorState } from "@/components/pomagier/primitives";
import { MapPin, Package, Layers, Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function fetchLocations() {
  const res = await fetch("/api/locations/stats");
  return res.json() as Promise<
    { code: string; area: string; aisle: number; rack: number; shelf: number; label: string; productCount: number; totalQuantity: number }[]
  >;
}

async function importLocations() {
  const res = await fetch("/api/locations/import", { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

async function syncProductLocations() {
  const res = await fetch("/api/locations/sync", { method: "POST" });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export const Route = createFileRoute("/admin/map")({
  component: AdminMap,
});

function AdminMap() {
  const { data: locations, isLoading, error } = useQuery({
    queryKey: ["locations"],
    queryFn: fetchLocations,
  });

  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const qc = useQueryClient();

  const importMut = useMutation({
    mutationFn: importLocations,
    onSuccess: (data: any) => {
      toast.success(`Zaimportowano ${data.imported} lokalizacji${data.skipped ? `, pominięto ${data.skipped}` : ""}`);
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const syncMut = useMutation({
    mutationFn: syncProductLocations,
    onSuccess: (data: any) => {
      toast.success(`Zsynchronizowano: ${data.inserted} powiązań towar-lokalizacja${data.skipped ? `, pominięto ${data.skipped}` : ""}`);
      qc.invalidateQueries({ queryKey: ["locations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = locations
    ? locations.reduce((map, loc) => {
        const list = map.get(loc.area) || [];
        list.push(loc);
        map.set(loc.area, list);
        return map;
      }, new Map<string, typeof locations>())
    : new Map();
  const totalAreas = grouped.size;
  const totalLocations = locations?.length ?? 0;
  const totalProducts = locations?.reduce((s, l) => s + l.productCount, 0) ?? 0;
  const totalQuantity = locations?.reduce((s, l) => s + l.totalQuantity, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mapa magazynu</h1>
        <p className="text-sm text-muted-foreground">Lokalizacje z Postgres — źródło prawdy dla PomagierGT</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => importMut.mutate()}
          disabled={importMut.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {importMut.isPending ? "Importuję…" : "Import lokalizacji"}
        </button>
        <button
          onClick={() => syncMut.mutate()}
          disabled={syncMut.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          {syncMut.isPending ? "Sync…" : "Synchronizuj towary"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Obszarów" value={String(totalAreas)} icon={<Layers className="h-4 w-4" />} tone="primary" />
        <KpiCard label="Lokalizacji" value={String(totalLocations)} icon={<MapPin className="h-4 w-4" />} tone="success" />
        <KpiCard label="Przypisanych towarów" value={String(totalProducts)} icon={<Package className="h-4 w-4" />} tone="info" />
        <KpiCard label="Łącznie sztuk" value={String(totalQuantity)} icon={<Package className="h-4 w-4" />} tone="warning" />
      </div>

      {isLoading && <LoadingRow />}
      {error && <ErrorState title="Błąd" description="Nie udało się pobrać lokalizacji" />}

      {grouped.size > 0 && (
        <div className="space-y-3">
          <SectionTitle title="Obszary" />
            {[...grouped.entries()].map(([area, locs]: [string, any[]]) => (
            <div key={area} className="rounded-lg border bg-card">
              <button
                onClick={() => setExpandedArea(expandedArea === area ? null : area)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                    {area}
                  </div>
                  <div>
                  <div className="font-semibold">Obszar {area}</div>
                  <div className="text-xs text-muted-foreground">
                    {locs.length} lokalizacji · {locs.reduce((s, l) => s + l.productCount, 0)} towarów · {locs.reduce((s, l) => s + l.totalQuantity, 0)} szt.
                  </div>
                  </div>
                </div>
                <span className="text-muted-foreground">{expandedArea === area ? "▲" : "▼"}</span>
              </button>

              {expandedArea === area && (
                <div className="border-t px-4 py-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {locs.map((loc) => (
                      <div key={loc.code} className="rounded-md border bg-muted/20 p-3 text-sm">
                        <div className="font-mono font-semibold">{loc.code}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Alejka {loc.aisle} · Regał {loc.rack} · Półka {loc.shelf}
                        </div>
                        {loc.productCount > 0 && (
                          <div className="mt-1 text-xs font-medium text-primary">
                            {loc.productCount} towarów · {loc.totalQuantity} szt.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
