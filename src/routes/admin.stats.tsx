import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getStats } from "@/lib/api";
import { KpiCard, SectionTitle, StatusBadge } from "@/components/pomagier/primitives";
import { useMssqlStatus } from "@/lib/use-status";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  HardDrive,
  MapPin,
  Package,
  RefreshCw,
  Server,
  ShieldAlert,
  Users,
} from "lucide-react";

type Tab = "operations" | "system";
type RangeDays = 1 | 7 | 30;

interface Movement {
  id: string;
  productId: number;
  symbol?: string;
  name?: string;
  fromCode?: string;
  toCode?: string;
  quantity: number;
  operator?: string;
  method?: string;
  createdAt: string;
}

interface ActivityData {
  movements: Movement[];
  dailyStats: { date: string; count: number }[];
  rangeDays: number;
}

interface LogData {
  rows: {
    id: string;
    category: string | null;
    method: string | null;
    action: string;
    actorSubiektUzId: number | null;
    createdAt: string;
  }[];
  total: number;
  stats?: { byCategory: Record<string, number>; byMethod: Record<string, number> };
}

interface SubiektChanges {
  count: number;
  since: string;
}

async function fetchActivity(days: RangeDays): Promise<ActivityData> {
  const response = await fetch(`/api/activity?days=${days}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchLogs(): Promise<LogData> {
  const response = await fetch("/api/logs?page=1&pageSize=100");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function fetchSubiektChanges(): Promise<SubiektChanges> {
  const response = await fetch("/api/locations/subiekt-changes");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const Route = createFileRoute("/admin/stats")({ component: AdminStats });

function MiniBars({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <div className="flex h-44 items-end gap-1.5 sm:gap-2">
      {data.map((item) => (
        <div key={item.date} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">
            {item.count}
          </span>
          <div
            className="min-h-1 w-full rounded-t-md bg-primary/25 transition-colors group-hover:bg-primary"
            style={{ height: `${Math.max(4, (item.count / max) * 100)}%` }}
            title={`${item.date}: ${item.count}`}
          />
          <span className="text-[10px] text-muted-foreground">{item.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function AdminStats() {
  const [tab, setTab] = useState<Tab>("operations");
  const [rangeDays, setRangeDays] = useState<RangeDays>(7);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { online, latencyMs } = useMssqlStatus();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: autoRefresh ? 30_000 : false,
  });
  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["stats-activity", rangeDays],
    queryFn: () => fetchActivity(rangeDays),
    refetchInterval: autoRefresh ? 30_000 : false,
  });
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["stats-logs"],
    queryFn: fetchLogs,
    refetchInterval: autoRefresh ? 30_000 : false,
  });
  const { data: changes } = useQuery({
    queryKey: ["stats-subiekt-changes"],
    queryFn: fetchSubiektChanges,
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const totalMoves = activity?.dailyStats.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const successfulLogins = logs?.stats?.byCategory?.auth ?? 0;
  const logErrors =
    logs?.rows.filter((row) => row.action.includes("error") || row.action.includes("failed"))
      .length ?? 0;

  const exportLogs = (format: "csv" | "json") => {
    window.open(`/api/logs/export.${format}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-5 pb-6">
      <header className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Analityka systemu
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Statystyki</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operacje magazynowe oraz kondycja PomagierGT i Subiekt GT.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={rangeDays}
            onChange={(event) => setRangeDays(Number(event.target.value) as RangeDays)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            aria-label="Zakres statystyk"
          >
            <option value={1}>Dzisiaj</option>
            <option value={7}>Ostatnie 7 dni</option>
            <option value={30}>Ostatnie 30 dni</option>
          </select>
          <button
            onClick={() => setAutoRefresh((value) => !value)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${autoRefresh ? "border-primary/40 text-primary" : "text-muted-foreground"}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Auto 30 s" : "Odświeżanie wyłączone"}
          </button>
        </div>
      </header>

      <nav className="flex gap-1 rounded-xl border bg-muted/40 p-1" aria-label="Zakładki statystyk">
        <button
          onClick={() => setTab("operations")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${tab === "operations" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Activity className="mr-2 inline h-4 w-4" /> Operacje magazynowe
        </button>
        <button
          onClick={() => setTab("system")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${tab === "system" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Server className="mr-2 inline h-4 w-4" /> System i ERP
        </button>
      </nav>

      {tab === "operations" ? (
        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Towary"
              value={statsLoading ? "…" : String(stats?.products ?? 0)}
              hint="Kartoteki tw__Towar"
              icon={<Package className="h-4 w-4" />}
              tone="primary"
            />
            <KpiCard
              label="Magazyny"
              value={statsLoading ? "…" : String(stats?.warehouses ?? 0)}
              hint="Słownik sl_Magazyn"
              icon={<MapPin className="h-4 w-4" />}
              tone="success"
            />
            <KpiCard
              label="Użytkownicy"
              value={statsLoading ? "…" : String(stats?.users ?? 0)}
              hint="Aktywni operatorzy"
              icon={<Users className="h-4 w-4" />}
              tone="info"
            />
            <KpiCard
              label="Ruchy"
              value={activityLoading ? "…" : String(totalMoves)}
              hint={`Zakres: ${rangeDays} dni`}
              icon={<ArrowRightLeft className="h-4 w-4" />}
              tone="warning"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <SectionTitle
                title="Ruchy w czasie"
                description="Przypisania, transfery i resety lokalizacji"
              />
              <div className="mt-5">
                <MiniBars data={activity?.dailyStats ?? []} />
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <SectionTitle
                title="Lokalizacje Subiekt"
                description="Zmiany wykryte od ostatniej kontroli"
              />
              <div
                className={`mt-5 rounded-xl border p-4 ${changes?.count ? "border-amber-300 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}`}
              >
                {changes?.count ? (
                  <>
                    <AlertTriangle className="mb-2 h-6 w-6 text-amber-600" />
                    <strong className="text-2xl text-amber-800">{changes.count}</strong>
                    <p className="text-xs text-amber-800">zmienionych produktów</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mb-2 h-6 w-6 text-emerald-600" />
                    <strong className="text-sm text-emerald-800">Brak rozbieżności</strong>
                    <p className="text-xs text-emerald-700">Stan wygląda poprawnie.</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <SectionTitle title="Ostatnie ruchy" description="Szczegóły operacji magazynowych" />
            <div className="mt-3 divide-y">
              {(activity?.movements ?? []).slice(0, 12).map((movement) => (
                <div key={movement.id} className="flex items-center gap-3 py-2.5 text-xs">
                  <ArrowRightLeft className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <b className="font-mono">{movement.symbol || `ID ${movement.productId}`}</b>
                    <span className="ml-2 text-muted-foreground">{movement.name}</span>
                  </div>
                  <span className="hidden font-mono text-muted-foreground md:block">
                    {movement.fromCode || "—"} → {movement.toCode || "—"}
                  </span>
                  <span className="font-semibold">×{movement.quantity}</span>
                  <span className="hidden text-muted-foreground sm:block">
                    {movement.operator || "system"}
                  </span>
                </div>
              ))}
              {!activityLoading && !activity?.movements.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Brak operacji w wybranym zakresie.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="MSSQL"
              value={online ? "Online" : "Offline"}
              hint={latencyMs ? `${latencyMs} ms` : "Brak odpowiedzi"}
              icon={<Database className="h-4 w-4" />}
              tone={online ? "success" : "danger"}
            />
            <KpiCard
              label="Logi"
              value={logsLoading ? "…" : String(logs?.total ?? 0)}
              hint="Zarejestrowane zdarzenia"
              icon={<BarChart3 className="h-4 w-4" />}
              tone="primary"
            />
            <KpiCard
              label="Błędy"
              value={String(logErrors)}
              hint="W bieżącej próbce logów"
              icon={<ShieldAlert className="h-4 w-4" />}
              tone="danger"
            />
            <KpiCard
              label="ERP sync"
              value={changes?.count ? String(changes.count) : "OK"}
              hint={changes?.count ? "Zmiany wymagają weryfikacji" : "Brak nowych zmian"}
              icon={<RefreshCw className="h-4 w-4" />}
              tone={changes?.count ? "warning" : "success"}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <SectionTitle title="Zdarzenia według kategorii" description="Dane z audit_log" />
              <div className="mt-4 space-y-3">
                {Object.entries(logs?.stats?.byCategory ?? {}).map(([category, count]) => (
                  <div key={category} className="flex items-center gap-3 text-sm">
                    <span className="w-24 font-mono text-xs">{category}</span>
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, (count / Math.max(1, logs?.total ?? 1)) * 100 * 4)}%`,
                        }}
                      />
                    </div>
                    <b className="w-10 text-right">{count}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <SectionTitle title="Stan usług" description="Bieżący monitoring" />
              <div className="mt-4 space-y-2">
                <StatusBadge tone={online ? "success" : "danger"}>
                  <Database className="mr-1 h-3 w-3" /> MSSQL {online ? "online" : "offline"}
                </StatusBadge>
                <StatusBadge tone="success">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> API odpowiada
                </StatusBadge>
                <StatusBadge tone="info">
                  <Clock3 className="mr-1 h-3 w-3" /> Auto-refresh:{" "}
                  {autoRefresh ? "aktywny" : "wyłączony"}
                </StatusBadge>
              </div>
              <div className="mt-4 flex gap-2 border-t pt-3">
                <a
                  href="/admin/logs"
                  className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs"
                >
                  <Download className="h-3 w-3" /> Otwórz logi
                </a>
                <a
                  href="/api/logs/export.json"
                  className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-xs"
                >
                  <Download className="h-3 w-3" /> Eksport JSON
                </a>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
