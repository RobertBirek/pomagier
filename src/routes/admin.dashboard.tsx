import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getStats, getCompany } from "@/lib/api";
import { KpiCard, ConnectionStatus, StatusBadge, SectionTitle } from "@/components/pomagier/primitives";
import { useMssqlStatus } from "@/lib/use-status";
import { Package, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["stats"], queryFn: getStats, refetchInterval: 30_000 });
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const { online } = useMssqlStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{company?.name || "PomagierGT"}</h1>
        <p className="text-sm text-muted-foreground">
          {company?.nip ? `NIP: ${company.nip}` : ""}
          {company?.regon ? ` · REGON: ${company.regon}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Towary"
          value={isLoading ? "..." : String(stats?.products ?? 0)}
          hint="Kartoteki w Subiekt GT"
          icon={<Package className="h-4 w-4" />}
          tone="primary"
        />
        <KpiCard
          label="Magazyny"
          value={isLoading ? "..." : String(stats?.warehouses ?? 0)}
          icon={<MapPin className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Użytkownicy"
          value={isLoading ? "..." : String(stats?.users ?? 0)}
          hint="Aktywni w Subiekt GT"
          icon={<Users className="h-4 w-4" />}
          tone="info"
        />
      </div>

      <div>
        <SectionTitle title="Status systemu" />
        <div className="mt-2 flex gap-3">
          <ConnectionStatus online={online} label="MSSQL" />
          <StatusBadge tone={online ? "success" : "danger"}>API</StatusBadge>
        </div>
      </div>
    </div>
  );
}
