import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getStats, getCompany } from "@/lib/api";
import { KpiCard, StatusBadge, SectionTitle } from "@/components/pomagier/primitives";
import { useMssqlStatus } from "@/lib/use-status";
import { Package, MapPin, Users, ArrowRightLeft, Clock, BarChart3 } from "lucide-react";

async function fetchActivity() {
  const r = await fetch("/api/activity");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{
    movements: {
      id: string;
      productId: number;
      symbol: string;
      name: string;
      fromCode: string;
      toCode: string;
      quantity: number;
      operator: string;
      createdAt: string;
    }[];
    scans: { code: string; timestamp: string }[];
    dailyStats: { date: string; count: number }[];
  }>;
}

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: 30_000,
  });
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const { data: activity } = useQuery({
    queryKey: ["activity"],
    queryFn: fetchActivity,
    refetchInterval: 15_000,
  });
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
        <SectionTitle title="Dzienna aktywność" />
        {activity?.dailyStats && (
          <div className="flex items-end gap-1 h-24 mt-2">
            {activity.dailyStats.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/20 hover:bg-primary/40 transition-colors"
                  style={{
                    height: `${Math.max(4, (d.count / Math.max(1, ...activity.dailyStats.map((s) => s.count))) * 80)}%`,
                  }}
                  title={`${d.date}: ${d.count} ruchów`}
                />
                <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2">
          <StatusBadge tone="info">
            <Clock className="mr-1 inline h-3 w-3" />
            {new Date().toLocaleTimeString("pl-PL")}
          </StatusBadge>
        </div>
      </div>

      {/* Recent movements */}
      <div className="rounded-lg border bg-card p-4">
        <SectionTitle title="Ostatnie ruchy" description="Z product_movements" />
        {activity?.movements && activity.movements.length > 0 ? (
          <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
            {activity.movements.slice(0, 10).map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 text-xs border-b last:border-0 py-1.5"
              >
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono font-semibold">{m.symbol || `ID ${m.productId}`}</span>
                  <span className="text-muted-foreground ml-1 truncate">{m.name}</span>
                </div>
                <div className="shrink-0 text-right">
                  {m.fromCode && m.toCode ? (
                    <span className="text-muted-foreground font-mono">
                      {m.fromCode} → <span className="font-semibold">{m.toCode}</span>
                    </span>
                  ) : m.toCode ? (
                    <span className="text-muted-foreground font-mono">
                      → <span className="font-semibold">{m.toCode}</span>
                    </span>
                  ) : (
                    <span className="text-destructive font-mono">← {m.fromCode}</span>
                  )}
                  <span className="ml-2">×{m.quantity}</span>
                </div>
                <span className="text-muted-foreground text-[10px] w-16 text-right">
                  {new Date(m.createdAt).toLocaleTimeString("pl-PL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">Brak ruchów</p>
        )}
      </div>

      <div>
        <SectionTitle title="Status systemu" />
        <div className="mt-2 flex gap-3">
          <StatusBadge tone={online ? "success" : "danger"}>
            MSSQL {online ? "online" : "offline"}
          </StatusBadge>
        </div>
      </div>
    </div>
  );
}
