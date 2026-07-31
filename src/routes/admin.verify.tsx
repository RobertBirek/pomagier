import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, X, Search, ArrowRightLeft, RotateCcw } from "lucide-react";

interface VerifyRow {
  productId: number;
  symbol: string;
  name: string;
  barcode: string;
  postgres: string[];
  subiekt: string[];
}

interface VerifyResult {
  totalProducts: number;
  synced: number;
  mismatches: number;
  rows: VerifyRow[];
  page: number;
  pageSize: number;
  totalPages: number;
}

const AREAS = ["", "A", "B", "C"];
const STATUSES = [
  { value: "all", label: "Wszystkie" },
  { value: "mismatch", label: "Tylko rozbieżności" },
  { value: "synced", label: "Tylko zgodne" },
];

async function fetchVerify(params: Record<string, string>): Promise<VerifyResult> {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`/api/locations/verify-sync-detail?${qs}`);
  if (!r.ok) throw new Error("Błąd pobierania");
  return r.json();
}

async function batchFix(ids: number[], dir: string) {
  const r = await fetch("/api/locations/fix-sync-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds: ids, direction: dir }),
  });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || "Błąd zapisu");
  return data as { ok: boolean; fixed?: number; imported?: number; cleared?: number };
}

async function fixAll() {
  const r = await fetch("/api/locations/fix-sync", { method: "POST" });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || "Błąd zapisu");
  return data as { ok: boolean; fixed: number };
}

async function clearAll() {
  const r = await fetch("/api/locations/clear-field", { method: "POST" });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || "Błąd zapisu");
  return data as { ok: boolean; rowsAffected?: number };
}

function SortTh({
  col,
  label,
  sortBy,
  sortOrder,
  onClick,
}: {
  col: string;
  label: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onClick: (col: string) => void;
}) {
  const active = sortBy === col;
  return (
    <th
      className="px-3 py-2 text-left font-semibold cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => onClick(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-xs">{sortOrder === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

export const Route = createFileRoute("/admin/verify")({ component: VerifyPage });

function VerifyPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("mismatch");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<string>("productId");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [malformedOnly, setMalformedOnly] = useState(false);
  const pageSize = 50;

  const isMalformed = (codes: string[]) => codes.some((c) => /^[A-Z]\d/.test(c.trim()));

  const params = useMemo(
    () => ({ page: String(page), pageSize: String(pageSize), area, status, q }),
    [page, area, status, q],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["verify-detail", params],
    queryFn: () => fetchVerify(params),
  });

  const sortedRows = useMemo(() => {
    if (!data?.rows) return [];
    const rows = [...data.rows];
    rows.sort((a, b) => {
      let va: string | number = "",
        vb: string | number = "";
      switch (sortBy) {
        case "productId":
          va = a.productId;
          vb = b.productId;
          break;
        case "symbol":
          va = a.symbol;
          vb = b.symbol;
          break;
        case "name":
          va = a.name;
          vb = b.name;
          break;
        case "postgres":
          va = a.postgres.join(", ");
          vb = b.postgres.join(", ");
          break;
        case "subiekt":
          va = a.subiekt.join(", ");
          vb = b.subiekt.join(", ");
          break;
      }
      if (va < vb) return sortOrder === "asc" ? -1 : 1;
      if (va > vb) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    if (malformedOnly) return rows.filter((r) => isMalformed(r.postgres) || isMalformed(r.subiekt));
    return rows;
  }, [data, sortBy, sortOrder, malformedOnly]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortOrder("asc");
    }
  };

  const batchMut = useMutation({
    mutationFn: ({ ids, dir }: { ids: number[]; dir: string }) => batchFix(ids, dir),
    onSuccess: (data) => {
      const msg =
        data.fixed != null
          ? `Zaktualizowano ${data.fixed} produktów`
          : data.imported != null
            ? `Zaimportowano ${data.imported}`
            : data.cleared != null
              ? `Wyczyszczono ${data.cleared}`
              : "Wykonano";
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["verify-detail"] });
      setSelected(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fixAllMut = useMutation({
    mutationFn: fixAll,
    onSuccess: (d: { ok: boolean; fixed: number }) => {
      toast.success(`Zaktualizowano ${d.fixed} produktów`);
      qc.invalidateQueries({ queryKey: ["verify-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearMut = useMutation({
    mutationFn: clearAll,
    onSuccess: () => {
      toast.success("Wyzerowano wszystkie lokalizacje");
      qc.invalidateQueries({ queryKey: ["verify-detail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const normalizeMut = useMutation({
    mutationFn: async (ids: number[]) => {
      const r = await fetch("/api/locations/normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: ids }),
      });
      const data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || "Błąd");
      return data as { ok: boolean; fixedPostgres: number; fixedSubiekt: number };
    },
    onSuccess: (data) => {
      toast.success(`Postgres: ${data.fixedPostgres}, Subiekt: ${data.fixedSubiekt}`);
      qc.invalidateQueries({ queryKey: ["verify-detail"] });
      setSelected(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAll = () => {
    if (!data) return;
    if (selected.size === sortedRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedRows.map((r) => r.productId)));
    }
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Weryfikacja spójności</h1>
        <p className="text-sm text-muted-foreground">Postgres vs Subiekt GT (tw_Pole1)</p>
      </div>

      {/* KPI cards */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-4 text-center">
            <div className="text-2xl font-bold">{data.totalProducts}</div>
            <div className="text-xs text-muted-foreground">Produktów</div>
          </div>
          <div className="rounded-lg border bg-emerald-50 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-700">{data.synced}</div>
            <div className="text-xs text-emerald-600">Zgodnych</div>
          </div>
          <div className="rounded-lg border bg-amber-50 p-4 text-center">
            <div className="text-2xl font-bold text-amber-700">{data.mismatches}</div>
            <div className="text-xs text-amber-600">Rozbieżności</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setPage(1);
          }}
          className="rounded border px-3 py-1.5 text-sm"
        >
          <option value="">Wszystkie obszary</option>
          {AREAS.filter(Boolean).map((a) => (
            <option key={a} value={a}>
              Obszar {a}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded border px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Szukaj lokalizacji np. A 1-2-3-4..."
          className="rounded border px-3 py-1.5 text-sm min-w-[200px] flex-1"
        />
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={malformedOnly}
            onChange={(e) => {
              setMalformedOnly(e.target.checked);
              setPage(1);
            }}
          />
          Nieprawidłowy format
        </label>
      </div>

      {/* Table */}
      {isLoading && (
        <div className="text-sm text-muted-foreground py-8 text-center">Ładowanie...</div>
      )}

      {data && sortedRows.length === 0 && (
        <div className="text-center py-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
          <p className="text-sm font-semibold">Brak rozbieżności</p>
          <p className="text-xs text-muted-foreground">Wszystkie lokalizacje są zgodne</p>
        </div>
      )}

      {data && sortedRows.length > 0 && (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === sortedRows.length && sortedRows.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <SortTh
                    col="productId"
                    label="ID"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onClick={handleSort}
                  />
                  <SortTh
                    col="symbol"
                    label="Symbol"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onClick={handleSort}
                  />
                  <SortTh
                    col="name"
                    label="Nazwa"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onClick={handleSort}
                  />
                  <SortTh
                    col="postgres"
                    label="Postgres"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onClick={handleSort}
                  />
                  <SortTh
                    col="subiekt"
                    label="Subiekt"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onClick={handleSort}
                  />
                  <th className="px-3 py-2 text-right font-semibold">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedRows.map((row) => {
                  const isMismatch = row.postgres.join(",") !== row.subiekt.join(",");
                  return (
                    <tr
                      key={row.productId}
                      className={isMismatch ? "bg-amber-50/30" : "bg-emerald-50/20"}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(row.productId)}
                          onChange={() => toggleOne(row.productId)}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.productId}</td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{row.symbol}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[150px] truncate">
                        {row.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.postgres.length > 0 ? (
                          row.postgres.join(", ")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.subiekt.length > 0 ? (
                          row.subiekt.join(", ")
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() =>
                            batchMut.mutate({ ids: [row.productId], dir: "postgres-to-subiekt" })
                          }
                          disabled={batchMut.isPending}
                          className="text-xs underline hover:no-underline text-primary"
                        >
                          Fix →
                        </button>
                        {(isMalformed(row.postgres) || isMalformed(row.subiekt)) && (
                          <button
                            onClick={() => normalizeMut.mutate([row.productId])}
                            disabled={normalizeMut.isPending}
                            className="text-xs underline hover:no-underline text-blue-600 ml-2"
                          >
                            Popraw
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border px-3 py-1 hover:bg-accent disabled:opacity-30"
              >
                ◀
              </button>
              <span className="text-muted-foreground">
                {page} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="rounded border px-3 py-1 hover:bg-accent disabled:opacity-30"
              >
                ▶
              </button>
            </div>
          )}

          {/* Batch actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Zaznaczone: {selected.size}</span>
            {selected.size > 0 && (
              <>
                <button
                  onClick={() =>
                    batchMut.mutate({ ids: [...selected], dir: "postgres-to-subiekt" })
                  }
                  disabled={batchMut.isPending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Subiekt ← Postgres
                </button>
                <button
                  onClick={() =>
                    batchMut.mutate({ ids: [...selected], dir: "subiekt-to-postgres" })
                  }
                  disabled={batchMut.isPending}
                  className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Postgres ← Subiekt
                </button>
                <button
                  onClick={() => batchMut.mutate({ ids: [...selected], dir: "clear" })}
                  disabled={batchMut.isPending}
                  className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive disabled:opacity-50"
                >
                  ✕ Wyczyść
                </button>
                <button
                  onClick={() => normalizeMut.mutate([...selected])}
                  disabled={normalizeMut.isPending}
                  className="rounded-md border border-blue-300 px-3 py-1.5 text-xs text-blue-600 disabled:opacity-50"
                >
                  Popraw format
                </button>
              </>
            )}
          </div>

          {/* Global actions */}
          <div className="flex gap-2 pt-2 border-t">
            <button
              onClick={() => {
                if (confirm("Nadpisać Subiekt danymi z Postgres dla wszystkich?"))
                  fixAllMut.mutate();
              }}
              disabled={fixAllMut.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {fixAllMut.isPending ? "…" : "Subiekt ← Postgres (all)"}
            </button>
            <button
              onClick={() => {
                if (confirm("Wyczyścić wszystkie lokalizacje? Tej operacji nie można cofnąć!"))
                  clearMut.mutate();
              }}
              disabled={clearMut.isPending}
              className="rounded-md border border-destructive/30 px-3 py-1.5 text-xs text-destructive disabled:opacity-50"
            >
              {clearMut.isPending ? "…" : "✕ Wyczyść (all)"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
