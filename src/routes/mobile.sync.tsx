import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPendingScans, replayQueue, getQueueCount } from "@/lib/offline-queue";
import {
  ConnectionStatus,
  StatusBadge,
  SectionTitle,
  EmptyState,
} from "@/components/pomagier/primitives";
import { useMssqlStatus } from "@/lib/use-status";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/mobile/sync")({
  component: SyncPage,
});

function SyncPage() {
  const { online } = useMssqlStatus();
  const qc = useQueryClient();
  const { data: scans = [] } = useQuery({
    queryKey: ["offline-queue"],
    queryFn: getPendingScans,
    refetchInterval: 3000,
  });
  const { data: count = 0 } = useQuery({
    queryKey: ["queue-count"],
    queryFn: getQueueCount,
    refetchInterval: 3000,
  });
  const [syncing, setSyncing] = useState(false);

  const handleReplay = async () => {
    setSyncing(true);
    try {
      const result = await replayQueue();
      toast.success(
        `Synchronizacja: ${result.ok} OK${result.failed ? `, ${result.failed} błędów` : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["offline-queue"] });
      qc.invalidateQueries({ queryKey: ["queue-count"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-lg font-bold">Synchronizacja</h1>

      <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
        {online ? (
          <Wifi className="h-5 w-5 text-success" />
        ) : (
          <WifiOff className="h-5 w-5 text-destructive" />
        )}
        <div>
          <div className="font-semibold text-sm">{online ? "Online" : "Offline"}</div>
          <div className="text-xs text-muted-foreground">
            {online ? "Połączono z MSSQL" : "Oczekiwanie na połączenie"}
          </div>
        </div>
        <StatusBadge tone={online ? "success" : "danger"}>{online ? "OK" : "—"}</StatusBadge>
      </div>

      {!online && count > 0 && (
        <div className="rounded-lg border-2 border-warning bg-warning/5 p-4">
          <div className="text-sm font-semibold">Oczekujące skany: {count}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Zostaną wysłane po przywróceniu połączenia
          </div>
          <button
            onClick={handleReplay}
            disabled={syncing}
            className="mt-3 touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synchronizuję…" : "Synchronizuj teraz"}
          </button>
        </div>
      )}

      {count === 0 && (
        <EmptyState
          icon={<RefreshCw className="h-8 w-8" />}
          title="Kolejka pusta"
          description="Brak oczekujących operacji"
        />
      )}
    </div>
  );
}
