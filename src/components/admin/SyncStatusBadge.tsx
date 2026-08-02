import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface SubiektChanges {
  since: string;
  newSince: string;
  count: number;
  products: {
    productId: number;
    symbol: string;
    name: string;
    subiektCodes: string[];
    subiektModifiedAt: string;
  }[];
}

async function fetchSubiektChanges(): Promise<SubiektChanges> {
  const r = await fetch("/api/locations/subiekt-changes");
  if (!r.ok) throw new Error("Błąd");
  return r.json();
}

interface SyncBatchResult {
  ok: boolean;
  fixed?: number;
  imported?: number;
  cleared?: number;
}

async function fixSyncBatch(productIds: number[]): Promise<SyncBatchResult> {
  const r = await fetch("/api/locations/fix-sync-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds, direction: "subiekt-to-postgres" }),
  });
  if (!r.ok) throw new Error("Błąd synchronizacji");
  return r.json();
}

export function SyncStatusBadge({ onSyncComplete }: { onSyncComplete: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["subiekt-changes"],
    queryFn: fetchSubiektChanges,
    refetchInterval: 30_000,
  });

  const syncMut = useMutation({
    mutationFn: (productIds: number[]) => fixSyncBatch(productIds),
    onSuccess: (result) => {
      const count = result.fixed ?? result.imported ?? 0;
      toast.success(`Zsynchronizowano ${count} produktów`);
      onSyncComplete();
      qc.invalidateQueries({ queryKey: ["subiekt-changes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return null;

  if (data.count === 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50/40 px-3 py-1.5 text-xs flex items-center gap-2">
        <span className="text-emerald-700">Zsynchronizowane z Subiekt</span>
        <span className="text-muted-foreground text-[10px]">
          ostatnia kontrola: {new Date(data.newSince).toLocaleString("pl-PL")}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50/40 px-3 py-2 text-xs flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
      <span className="font-semibold text-amber-800">
        {data.count} produktów zmienionych w Subiekcie
      </span>
      <span className="text-muted-foreground">
        od {new Date(data.since).toLocaleString("pl-PL")}
      </span>
      <button
        onClick={() => syncMut.mutate(data.products.map((p) => p.productId))}
        disabled={syncMut.isPending}
        className="ml-auto rounded bg-amber-600 px-2.5 py-1 text-white font-medium hover:bg-amber-700 disabled:opacity-50"
      >
        {syncMut.isPending ? "Synchronizuję…" : "Sync teraz"}
      </button>
    </div>
  );
}
