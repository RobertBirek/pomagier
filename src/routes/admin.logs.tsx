import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SectionTitle, LoadingRow, EmptyState } from "@/components/pomagier/primitives";
import { ScrollText, ArrowRightLeft, Package, Clock, Hash, LogIn, LogOut, ShieldAlert } from "lucide-react";
import { useState } from "react";

interface LogEntry {
  id: string; type: string; productId?: number; symbol?: string; name?: string;
  fromCode?: string; toCode?: string; quantity?: number; operator?: string;
  action?: string; details?: string; userId?: string;
  correlationId: string; createdAt: string;
}

async function fetchLogs(page: number) {
  const r = await fetch(`/api/logs?page=${page}&pageSize=50`);
  return r.json() as Promise<{ rows: LogEntry[]; total: number; page: number; pageSize: number }>;
}

export const Route = createFileRoute("/admin/logs")({ component: AdminLogs });

function AdminLogs() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ["logs", page], queryFn: () => fetchLogs(page), refetchInterval: 10_000 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Logi</h1>
        <p className="text-sm text-muted-foreground">Historia ruchów towarów — product_movements</p>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{data?.total ?? 0} wpisów</span>
      </div>

      {isLoading && <LoadingRow />}

      {data?.rows && data.rows.length > 0 ? (
        <>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium w-16">ID</th>
                  <th className="px-4 py-2 text-left font-medium">Towar</th>
                  <th className="px-4 py-2 text-left font-medium">Ruch</th>
                  <th className="px-4 py-2 text-right font-medium">Ilość</th>
                  <th className="px-4 py-2 text-left font-medium hidden md:table-cell">Operator</th>
                  <th className="px-4 py-2 text-right font-medium">Czas</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                <tr key={row.id} className={`border-b hover:bg-muted/30 ${row.type === "audit" ? "bg-muted/20" : ""}`}>
                  {row.type === "audit" ? (
                    <>
                      <td colSpan={2} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {row.action === "login" ? <LogIn className="h-4 w-4 text-success" /> : row.action === "login_failed" ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <ScrollText className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-semibold text-xs">{row.action === "login" ? "Logowanie" : row.action === "login_failed" ? "Błędny PIN" : row.action}</span>
                        </div>
                        {row.details && <div className="text-xs text-muted-foreground mt-0.5 font-mono">{(() => { try { return JSON.stringify(JSON.parse(row.details)); } catch { return row.details; } })()}</div>}
                      </td>
                      <td colSpan={4} className="px-4 py-2 text-right text-xs text-muted-foreground font-mono whitespace-nowrap">{new Date(row.createdAt).toLocaleString("pl-PL")}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{row.productId}</td>
                      <td className="px-4 py-2"><div className="font-mono text-xs font-semibold">{row.symbol}</div><div className="text-xs text-muted-foreground truncate max-w-[150px]">{row.name}</div></td>
                      <td className="px-4 py-2">{row.fromCode && row.toCode ? <span className="inline-flex items-center gap-1 text-xs"><span className="font-mono text-muted-foreground">{row.fromCode}</span><ArrowRightLeft className="h-3 w-3 text-primary" /><span className="font-mono font-semibold">{row.toCode}</span></span> : row.toCode ? <span className="font-mono text-xs text-success">→ {row.toCode}</span> : <span className="font-mono text-xs text-destructive">← {row.fromCode}</span>}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold">×{row.quantity}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground hidden md:table-cell">{row.operator || "—"}</td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground font-mono whitespace-nowrap">{new Date(row.createdAt).toLocaleString("pl-PL")}</td>
                    </>
                  )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total > 50 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border px-3 py-1 text-sm hover:bg-accent disabled:opacity-30">←</button>
              <span className="px-3 py-1 text-sm text-muted-foreground">{page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= data.total} className="rounded border px-3 py-1 text-sm hover:bg-accent disabled:opacity-30">→</button>
            </div>
          )}
        </>
      ) : (
        !isLoading && <EmptyState icon={<ScrollText className="h-8 w-8" />} title="Brak wpisów" description="Ruchy będą widoczne po pierwszych operacjach na lokalizacjach" />
      )}
    </div>
  );
}
