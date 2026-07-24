import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getStats, getCompany, healthCheck } from "@/lib/api";
import { KpiCard, StatusBadge, SectionTitle, ErrorState, LoadingRow } from "@/components/pomagier/primitives";
import { Database, Server, HardDrive, Clock, Package, Users, MapPin } from "lucide-react";

export const Route = createFileRoute("/admin/erp")({
  component: AdminErp,
});

function AdminErp() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: 15_000,
  });
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const { data: health } = useQuery({ queryKey: ["health"], queryFn: healthCheck, refetchInterval: 10_000 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subiekt GT</h1>
        <p className="text-sm text-muted-foreground">Status połączenia i dane z bazy ERP</p>
      </div>

      {/* Connection status */}
      <div className="rounded-lg border bg-card p-4">
        <SectionTitle title="Połączenie MSSQL" description="Stan integracji z Insert Subiekt GT" />
        <div className="mt-3 flex flex-wrap gap-3">
          {health?.erp?.ok ? (
            <StatusBadge tone="success">
              <Server className="mr-1 h-3 w-3" />
              Połączono ({health.erp.latencyMs} ms)
            </StatusBadge>
          ) : (
            <StatusBadge tone="danger">
              <Server className="mr-1 h-3 w-3" />
              Rozłączono
              {health?.erp?.error && <span className="ml-1">— {health.erp.error}</span>}
            </StatusBadge>
          )}
          <StatusBadge tone="info">
            <Clock className="mr-1 h-3 w-3" />
            {new Date().toLocaleTimeString("pl-PL")}
          </StatusBadge>
        </div>
      </div>

      {/* Company info */}
      {company && (
        <div className="rounded-lg border bg-card p-4">
          <SectionTitle title="Firma" />
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Nazwa:</span>{" "}
              <span className="font-semibold">{company.name || "(bez nazwy)"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">NIP:</span>{" "}
              <span className="font-mono">{company.nip || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">REGON:</span>{" "}
              <span className="font-mono">{company.regon || "—"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Table counts */}
      <div>
        <SectionTitle title="Tabele Subiekt GT" description="Liczba rekordów w kluczowych tabelach" />
        {statsLoading && <LoadingRow />}
        {stats && (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <KpiCard label="tw__Towar" value={String(stats.products)} hint="Kartoteki towarowe" icon={<Package className="h-4 w-4" />} tone="primary" />
            <KpiCard label="sl_Magazyn" value={String(stats.warehouses)} hint="Magazyny" icon={<MapPin className="h-4 w-4" />} tone="success" />
            <KpiCard label="pd_Uzytkownik" value={String(stats.users)} hint="Operatorzy" icon={<Users className="h-4 w-4" />} tone="info" />
          </div>
        )}
      </div>

      {/* Server info */}
      <div className="rounded-lg border bg-card p-4">
        <SectionTitle title="Konfiguracja" description="Ustawienia połączenia (z pliku .env)" />
        <div className="mt-3 grid gap-1 text-xs font-mono text-muted-foreground">
          <div>
            MSSQL_HOST: <span className="text-foreground">{import.meta.env.VITE_MSSQL_HOST || "***"}</span>
          </div>
          <div>
            DATABASE: <span className="text-foreground">pomagier</span>
          </div>
          <div>
            API: <span className="text-foreground">{window.location.protocol}//{window.location.hostname}:3000</span>
          </div>
        </div>
      </div>
    </div>
  );
}
