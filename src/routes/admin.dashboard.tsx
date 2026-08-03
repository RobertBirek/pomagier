import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getStats, getCompany } from "@/lib/api";
import { KpiCard, StatusBadge, SectionTitle } from "@/components/pomagier/primitives";
import { useMssqlStatus } from "@/lib/use-status";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  MapPin,
  Package,
  RefreshCw,
  Users,
} from "lucide-react";

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

interface SubiektChanges {
  count: number;
  since: string;
  products: { productId: number; symbol?: string; name?: string }[];
}

async function fetchActivity(days: number): Promise<ActivityData> {
  const r = await fetch(`/api/activity?days=${days}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchSubiektChanges(): Promise<SubiektChanges> {
  const r = await fetch("/api/locations/subiekt-changes");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const Route = createFileRoute("/admin/dashboard")({ component: AdminDashboard });

function AdminDashboard() {
  const [rangeDays, setRangeDays] = useState(7);
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: 30_000,
  });
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const {
    data: activity,
    isLoading: activityLoading,
    isFetching: activityFetching,
  } = useQuery({
    queryKey: ["activity", rangeDays],
    queryFn: () => fetchActivity(rangeDays),
    refetchInterval: 30_000,
  });
  const { data: changes, isFetching: changesFetching } = useQuery({
    queryKey: ["subiekt-changes"],
    queryFn: fetchSubiektChanges,
    refetchInterval: 30_000,
  });
  const { online } = useMssqlStatus();

  const maxActivity = Math.max(1, ...(activity?.dailyStats.map((item) => item.count) ?? [0]));
  const totalMoves = activity?.dailyStats.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const lastMove = activity?.movements[0];

  return (
    <div className="space-y-6 pb-6">
      <header className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Centrum dowodzenia
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {company?.name || "PomagierGT"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stan magazynu, synchronizacji i aktywności firmy w jednym miejscu.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge tone={online ? "success" : "danger"}>
            <Database className="mr-1 h-3 w-3" /> ERP {online ? "online" : "offline"}
          </StatusBadge>
          <StatusBadge tone="info">
            <Clock3 className="mr-1 h-3 w-3" /> {new Date().toLocaleTimeString("pl-PL")}
          </StatusBadge>
          {(activityFetching || changesFetching) && (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Towary"
          value={statsLoading ? "…" : String(stats?.products ?? 0)}
          hint="Kartoteki w Subiekt GT"
          icon={<Package className="h-4 w-4" />}
          tone="primary"
        />
        <KpiCard
          label="Magazyny"
          value={statsLoading ? "…" : String(stats?.warehouses ?? 0)}
          hint="Dostępne w ERP"
          icon={<MapPin className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Użytkownicy"
          value={statsLoading ? "…" : String(stats?.users ?? 0)}
          hint="Operatorzy z Subiekta"
          icon={<Users className="h-4 w-4" />}
          tone="info"
        />
        <KpiCard
          label="Ruchy"
          value={activityLoading ? "…" : String(totalMoves)}
          hint={`Ostatnie ${rangeDays} dni`}
          icon={<Activity className="h-4 w-4" />}
          tone="warning"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title="Aktywność operacyjna"
              description="Ruchy lokalizacji i operacje magazynowe"
            />
            <select
              value={rangeDays}
              onChange={(event) => setRangeDays(Number(event.target.value))}
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              aria-label="Zakres aktywności"
            >
              <option value={1}>Dzisiaj</option>
              <option value={7}>7 dni</option>
              <option value={30}>30 dni</option>
            </select>
          </div>
          <div className="mt-6 flex h-40 items-end gap-1.5 sm:gap-2">
            {(activity?.dailyStats ?? []).map((item) => (
              <div
                key={item.date}
                className="group flex min-w-0 flex-1 flex-col items-center gap-1"
              >
                <span className="text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {item.count}
                </span>
                <div
                  className="w-full min-h-1 rounded-t-md bg-primary/25 transition-all group-hover:bg-primary"
                  style={{ height: `${Math.max(4, (item.count / maxActivity) * 100)}%` }}
                  title={`${item.date}: ${item.count} ruchów`}
                />
                <span className="text-[10px] text-muted-foreground">{item.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>
              Łącznie: <b className="text-foreground">{totalMoves}</b> operacji
            </span>
            <Link
              to="/admin/logs"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Pełne logi <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <SectionTitle
            title="Synchronizacja Subiekt"
            description="Ręczne zmiany lokalizacji w ERP"
          />
          {changes ? (
            <div
              className={`mt-5 rounded-xl border p-4 ${changes.count > 0 ? "border-amber-300 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}`}
            >
              {changes.count > 0 ? (
                <>
                  <AlertTriangle className="mb-3 h-7 w-7 text-amber-600" />
                  <div className="text-2xl font-bold text-amber-800">{changes.count}</div>
                  <p className="mt-1 text-xs text-amber-800">produktów zmienionych w Subiekcie</p>
                  <Link
                    to="/admin/verify"
                    className="mt-4 inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Zweryfikuj <ExternalLink className="h-3 w-3" />
                  </Link>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mb-3 h-7 w-7 text-emerald-600" />
                  <div className="text-lg font-bold text-emerald-800">Synchronizacja OK</div>
                  <p className="mt-1 text-xs text-emerald-700">
                    Brak nowych zmian w lokalizacjach.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="mt-5 text-sm text-muted-foreground">Sprawdzam Subiekt…</div>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle title="Ostatnie operacje" description="Najświeższe zmiany lokalizacji" />
            <Link to="/admin/logs" className="text-xs text-primary hover:underline">
              Zobacz wszystkie
            </Link>
          </div>
          <div className="mt-3 divide-y">
            {(activity?.movements ?? []).slice(0, 8).map((movement) => (
              <div key={movement.id} className="flex items-center gap-3 py-2.5 text-xs">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono font-semibold">
                    {movement.symbol || `ID ${movement.productId}`}
                  </div>
                  <div className="truncate text-muted-foreground">{movement.name || "Towar"}</div>
                </div>
                <div className="hidden text-right font-mono text-muted-foreground sm:block">
                  {movement.fromCode || "—"} → {movement.toCode || "—"}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold">×{movement.quantity}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {movement.operator || "system"}
                  </div>
                </div>
              </div>
            ))}
            {!activityLoading && (activity?.movements.length ?? 0) === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Brak operacji w wybranym okresie.
              </div>
            )}
          </div>
          {lastMove && (
            <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">
              Ostatnia zmiana: {new Date(lastMove.createdAt).toLocaleString("pl-PL")}
            </p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <SectionTitle title="Szybkie akcje" description="Przejdź od razu do kontroli" />
          <div className="mt-4 grid gap-2">
            <Link
              to="/admin/verify"
              className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm hover:bg-muted/50"
            >
              Weryfikacja lokalizacji <MapPin className="h-4 w-4 text-primary" />
            </Link>
            <Link
              to="/admin/logs"
              className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm hover:bg-muted/50"
            >
              Przeglądaj logi <BarChart3 className="h-4 w-4 text-primary" />
            </Link>
            <Link
              to="/admin/erp"
              className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm hover:bg-muted/50"
            >
              Konfiguracja ERP <Database className="h-4 w-4 text-primary" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
