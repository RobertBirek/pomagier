import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KpiCard, SectionTitle, LoadingRow, ErrorState, EmptyState } from "@/components/pomagier/primitives";
import { MapPin, Package, Layers } from "lucide-react";
import { groupByArea } from "@/lib/locations";
import { useState } from "react";

async function fetchLocations() {
  const res = await fetch("/api/locations");
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

  const grouped = locations ? groupByArea(locations) : new Map();
  const totalAreas = grouped.size;
  const totalLocations = locations?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mapa magazynu</h1>
        <p className="text-sm text-muted-foreground">Lokalizacje towarów z pola własnego "Lokalizacja" (tw_Pole1)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Obszarów" value={String(totalAreas)} icon={<Layers className="h-4 w-4" />} tone="primary" />
        <KpiCard label="Lokalizacji" value={String(totalLocations)} icon={<MapPin className="h-4 w-4" />} tone="success" />
        <KpiCard label="Towarów z lokalizacją" value={String(totalLocations)} icon={<Package className="h-4 w-4" />} tone="info" hint="Unikalne lokalizacje" />
      </div>

      {isLoading && <LoadingRow />}
      {error && <ErrorState title="Błąd" description="Nie udało się pobrać lokalizacji" />}

      {grouped.size > 0 && (
        <div className="space-y-3">
          <SectionTitle title="Obszary" />
          {[...grouped.entries()].map(([area, locs]) => (
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
                    <div className="text-xs text-muted-foreground">{locs.length} lokalizacji</div>
                  </div>
                </div>
                <span className="text-muted-foreground">{expandedArea === area ? "▲" : "▼"}</span>
              </button>

              {expandedArea === area && (
                <div className="border-t px-4 py-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {locs.map((loc) => (
                      <div
                        key={loc.raw}
                        className="rounded-md border bg-muted/20 p-3 text-sm"
                      >
                        <div className="font-mono font-semibold">{loc.raw}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Alejka {loc.aisle} · Regał {loc.rack} · Półka {loc.shelf}
                        </div>
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
