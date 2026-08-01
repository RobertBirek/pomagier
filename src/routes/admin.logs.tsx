import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoadingRow, EmptyState } from "@/components/pomagier/primitives";
import { ScrollText, Search, X, Download, Calendar } from "lucide-react";

interface LogEntry {
  id: string;
  createdAt: string;
  category: string | null;
  method: string | null;
  action: string;
  actorSubiektUzId: number | null;
  userId: string | null;
  targetType: string | null;
  targetId: string | null;
  correlationId: string;
  details: string | null;
}

async function fetchLogs(params: URLSearchParams) {
  const r = await fetch(`/api/logs?${params.toString()}`);
  return r.json() as Promise<{
    rows: LogEntry[];
    total: number;
    page: number;
    pageSize: number;
    stats: { byCategory: Record<string, number>; byMethod: Record<string, number> };
  }>;
}

async function fetchUsers() {
  const r = await fetch("/api/logs/users");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{ users: number[] }>;
}

const CATEGORIES = ["auth", "admin", "mobile", "erp", "queue", "system"];
const METHODS = ["web", "mobile", "system", "verification"];

export const Route = createFileRoute("/admin/logs")({ component: AdminLogs });

function AdminLogs() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    category: string[];
    method: string[];
    user: string;
    from: string;
    to: string;
    q: string;
    correlation: string;
  }>({
    category: [],
    method: [],
    user: "",
    from: "",
    to: "",
    q: "",
    correlation: "",
  });
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);

  const search = Route.useSearch() as { correlation?: string };
  useEffect(() => {
    const c = search.correlation;
    if (typeof c === "string" && c.length > 0) {
      setFilters((f) => (f.correlation === c ? f : { ...f, correlation: c, q: "" }));
    }
  }, [search.correlation]);

  const params = new URLSearchParams();
  if (filters.category.length > 0) params.set("category", filters.category.join(","));
  if (filters.method.length > 0) params.set("method", filters.method.join(","));
  if (filters.user) params.set("user", filters.user);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q) params.set("q", filters.q);
  if (filters.correlation) params.set("correlation", filters.correlation);
  params.set("page", String(page));

  const { data, isLoading } = useQuery({
    queryKey: ["logs-v2", params.toString()],
    queryFn: () => fetchLogs(params),
    refetchInterval: 10_000,
  });

  const { data: usersData } = useQuery({ queryKey: ["logs-users"], queryFn: fetchUsers });

  const toggleArray = (key: "category" | "method", value: string) => {
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));
    setPage(1);
  };

  const buildExportUrl = (format: "csv" | "json") => {
    const p = new URLSearchParams(params);
    p.delete("page");
    return `/api/logs/export.${format}?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Logi</h1>
        <p className="text-sm text-muted-foreground">
          Pełen event log — auth, admin CRUD, mobile actions, ERP queries, offline queue, system
        </p>
      </div>

      {/* Filters bar */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        {/* Search + date range */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={filters.q}
              onChange={(e) => {
                setFilters((f) => ({ ...f, q: e.target.value }));
                setPage(1);
              }}
              placeholder="Szukaj (akcja, details, targetId)..."
              className="w-full rounded border bg-background pl-8 pr-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={filters.from}
              onChange={(e) => {
                setFilters((f) => ({ ...f, from: e.target.value }));
                setPage(1);
              }}
              className="rounded border bg-background px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => {
                setFilters((f) => ({ ...f, to: e.target.value }));
                setPage(1);
              }}
              className="rounded border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Multi-select chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-muted-foreground">Category:</span>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => toggleArray("category", c)}
              className={`rounded-full px-2 py-0.5 ${
                filters.category.includes(c)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {c}
            </button>
          ))}
          <span className="ml-2 font-medium text-muted-foreground">Method:</span>
          {METHODS.map((m) => (
            <button
              key={m}
              onClick={() => toggleArray("method", m)}
              className={`rounded-full px-2 py-0.5 ${
                filters.method.includes(m)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {m}
            </button>
          ))}
          <select
            value={filters.user}
            onChange={(e) => {
              setFilters((f) => ({ ...f, user: e.target.value }));
              setPage(1);
            }}
            className="ml-2 rounded border bg-background px-2 py-1 text-sm"
          >
            <option value="">Wszyscy użytkownicy</option>
            {(usersData?.users ?? []).map((id) => (
              <option key={id} value={id}>
                Operator {id}
              </option>
            ))}
          </select>
          {filters.correlation && (
            <span
              data-testid="correlation-chip"
              className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"
            >
              Correlation: {filters.correlation}
              <button
                type="button"
                aria-label="Clear correlation filter"
                onClick={() => {
                  setFilters((f) => ({ ...f, correlation: "" }));
                  setPage(1);
                }}
                className="rounded-full p-0.5 hover:bg-primary-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>

        {/* KPI */}
        {data?.stats && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t">
            <span>
              Total: <b>{data.total}</b>
            </span>
            {Object.entries(data.stats.byCategory).map(([k, v]) => (
              <span key={k}>
                {k}: <b>{v}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions: export */}
      <div className="flex items-center gap-2">
        <a
          href={buildExportUrl("csv")}
          className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <Download className="h-4 w-4" /> CSV
        </a>
        <a
          href={buildExportUrl("json")}
          className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <Download className="h-4 w-4" /> JSON
        </a>
      </div>

      {/* Table */}
      {isLoading && <LoadingRow />}
      {data?.rows && data.rows.length > 0 ? (
        <>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium w-44">Czas</th>
                  <th className="px-3 py-2 text-left font-medium w-24">Category</th>
                  <th className="px-3 py-2 text-left font-medium w-20">Method</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium w-20">Actor</th>
                  <th className="px-3 py-2 text-left font-medium">Target</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedEntry(r)}
                    className="border-b hover:bg-muted/30 cursor-pointer"
                  >
                    <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString("pl-PL")}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.category ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.method ?? "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono">{r.action}</td>
                    <td className="px-3 py-2 text-xs">{r.actorSubiektUzId ?? "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {r.targetType ? `${r.targetType}:${r.targetId}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">▶</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total > data.pageSize && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border px-3 py-1 text-sm"
              >
                ←
              </button>
              <span className="px-3 py-1 text-sm">{page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * data.pageSize >= data.total}
                className="rounded border px-3 py-1 text-sm"
              >
                →
              </button>
            </div>
          )}
        </>
      ) : (
        !isLoading && (
          <EmptyState
            icon={<ScrollText className="h-8 w-8" />}
            title="Brak wpisów"
            description="Logi pojawią się po aktywności w systemie"
          />
        )
      )}

      {/* Detail modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedEntry(null)}
        >
          <div
            className="mx-4 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">Log details</h2>
              <button
                onClick={() => setSelectedEntry(null)}
                className="rounded p-1 hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div>
                <b>ID:</b> {selectedEntry.id}
              </div>
              <div>
                <b>Time:</b> {new Date(selectedEntry.createdAt).toLocaleString("pl-PL")}
              </div>
              <div>
                <b>Category:</b> {selectedEntry.category}
              </div>
              <div>
                <b>Method:</b> {selectedEntry.method}
              </div>
              <div>
                <b>Action:</b> {selectedEntry.action}
              </div>
              <div>
                <b>Actor (subiektUzId):</b> {selectedEntry.actorSubiektUzId ?? "—"}
              </div>
              <div>
                <b>Target:</b>{" "}
                {selectedEntry.targetType
                  ? `${selectedEntry.targetType}:${selectedEntry.targetId}`
                  : "—"}
              </div>
              <div>
                <b>Correlation ID:</b> {selectedEntry.correlationId}
              </div>
              <div>
                <b>Details:</b>
                <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(selectedEntry.details ?? "{}"), null, 2);
                    } catch {
                      return selectedEntry.details ?? "—";
                    }
                  })()}
                </pre>
              </div>
              <div>
                <b>Related events by correlation:</b>{" "}
                <Link
                  to="/admin/logs"
                  search={{ correlation: selectedEntry.correlationId }}
                  className="text-primary underline"
                >
                  View all with correlation {selectedEntry.correlationId.slice(0, 8)}...
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
