import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPendingScans,
  replayQueue,
  clearQueue,
  getQueueCount,
  type ReplayItem,
} from "@/lib/offline-queue";
import { StatusBadge, SectionTitle, EmptyState } from "@/components/pomagier/primitives";
import { useMssqlStatus } from "@/lib/use-status";
import { useAuth } from "@/lib/auth";
import { RefreshCw, Wifi, WifiOff, Trash2, XCircle, CheckCircle2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/mobile/sync")({
  component: SyncPage,
});

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "przed chwilą";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min temu`;
  const hours = Math.floor(mins / 60);
  return `${hours}h temu`;
}

function SyncPage() {
  const { online } = useMssqlStatus();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: scans = [] } = useQuery({
    queryKey: ["offline-queue-scans"],
    queryFn: getPendingScans,
    refetchInterval: 3000,
  });
  const { data: count = 0 } = useQuery({
    queryKey: ["queue-count"],
    queryFn: getQueueCount,
    refetchInterval: 3000,
  });

  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<ReplayItem[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleReplay = async () => {
    setSyncing(true);
    setResults(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const result = await replayQueue(user?.subiektUzId, ctrl.signal);
      setResults(result.items);
      if (result.failed === 0) {
        toast.success(`Wszystkie ${result.ok} skany zsynchronizowane`);
      } else {
        toast.warning(`${result.ok} OK, ${result.failed} błędów`);
      }
      qc.invalidateQueries({ queryKey: ["offline-queue-scans"] });
      qc.invalidateQueries({ queryKey: ["queue-count"] });
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        toast.error(e.message || "Błąd synchronizacji");
      }
    } finally {
      setSyncing(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    toast("Anulowano");
  };

  const handleClear = async () => {
    await clearQueue();
    setResults(null);
    qc.invalidateQueries({ queryKey: ["offline-queue-scans"] });
    qc.invalidateQueries({ queryKey: ["queue-count"] });
    toast.success("Kolejka wyczyszczona");
  };

  const hasResults = results && results.length > 0;
  const resultOk = hasResults ? results.filter((r) => r.ok).length : 0;
  const resultFailed = hasResults ? results.filter((r) => !r.ok).length : 0;

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <SectionTitle title="Synchronizacja" />

      {/* Connection status */}
      <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
        {online ? (
          <Wifi className="h-5 w-5 text-success" />
        ) : (
          <WifiOff className="h-5 w-5 text-destructive" />
        )}
        <div className="flex-1">
          <div className="font-semibold text-sm">{online ? "Online" : "Offline"}</div>
          <div className="text-xs text-muted-foreground">
            {online ? "Połączono z MSSQL" : "Oczekiwanie na połączenie"}
          </div>
        </div>
        <StatusBadge tone={online ? "success" : "danger"}>{online ? "OK" : "—"}</StatusBadge>
      </div>

      {/* Pending queue */}
      {count > 0 && (
        <div className="rounded-lg border-2 border-warning/40 bg-warning/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              Oczekujące: {count} skan{count !== 1 ? "ów" : ""}
            </div>
            {!online && (
              <span className="text-xs text-muted-foreground">
                Zostaną wysłane po przywróceniu połączenia
              </span>
            )}
          </div>

          {/* Scan list */}
          <div className="max-h-48 overflow-y-auto border rounded-lg bg-card divide-y">
            {scans.map((scan) => (
              <div key={scan.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="font-mono text-xs break-all flex-1 min-w-0 mr-2">{scan.code}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatTime(scan.timestamp)}
                </span>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            {syncing ? (
              <button
                onClick={handleCancel}
                className="flex-1 touch-target rounded-md border border-destructive/40 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 active:scale-95 transition-all inline-flex items-center justify-center gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                Anuluj
              </button>
            ) : (
              <>
                <button
                  onClick={handleReplay}
                  disabled={!online}
                  className="flex-1 touch-target rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 active:scale-95 transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="h-4 w-4" />
                  Synchronizuj
                </button>
                <button
                  onClick={handleClear}
                  className="touch-target rounded-md border border-destructive/30 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 active:scale-95 transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Wyczyść
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {count === 0 && !hasResults && (
        <EmptyState
          icon={<RefreshCw className="h-8 w-8" />}
          title="Kolejka pusta"
          description="Brak oczekujących operacji"
        />
      )}

      {/* Sync results */}
      {hasResults && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Wynik synchronizacji</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-success font-medium">{resultOk} OK</span>
              {resultFailed > 0 && (
                <span className="text-destructive font-medium">{resultFailed} błędów</span>
              )}
            </div>
          </div>

          <div className="divide-y max-h-48 overflow-y-auto border rounded-lg">
            {results.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs break-all">{item.code}</span>
                  {item.error && (
                    <div className="text-[11px] text-destructive/80 truncate">{item.error}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
