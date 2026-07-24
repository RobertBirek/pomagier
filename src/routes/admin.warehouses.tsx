import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getWarehouses } from "@/lib/api";
import { KpiCard, StatusBadge, SectionTitle, EmptyState, ErrorState, LoadingRow } from "@/components/pomagier/primitives";
import { MapPin, Home, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/warehouses")({
  component: AdminWarehouses,
});

function AdminWarehouses() {
  const { data: warehouses, isLoading, error } = useQuery({
    queryKey: ["warehouses"],
    queryFn: getWarehouses,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Magazyny</h1>
        <p className="text-sm text-muted-foreground">Dane z sl_Magazyn w Subiekt GT</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Liczba magazynów" value={String(warehouses?.length ?? 0)} icon={<MapPin className="h-4 w-4" />} tone="primary" />
        <KpiCard label="Główny" value={warehouses?.find((w) => w.isMain)?.symbol ?? "—"} icon={<Home className="h-4 w-4" />} tone="success" />
      </div>

      {isLoading && <LoadingRow />}
      {error && <ErrorState title="Błąd" description="Nie udało się pobrać magazynów" />}

      {warehouses && warehouses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <div key={w.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{w.name}</span>
                </div>
                {w.isMain && (
                  <StatusBadge tone="success">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Główny
                  </StatusBadge>
                )}
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Symbol: <span className="font-mono font-semibold text-foreground">{w.symbol}</span></div>
                <div>ID: <span className="font-mono">{w.id}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {warehouses && warehouses.length === 0 && <EmptyState title="Brak magazynów" description="Subiekt GT nie zwrócił danych" />}
    </div>
  );
}
