import { History, RotateCcw } from "lucide-react";

interface HistoryEntry {
  codes: string[];
  location: string;
  timestamp: number;
  products: { id: number; symbol: string }[];
}

interface HistoryPanelProps {
  entries: HistoryEntry[];
  loading: boolean;
  onUndo: (entry: HistoryEntry) => void;
}

export function HistoryPanel({ entries, loading, onUndo }: HistoryPanelProps) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        Ostatnie operacje
      </div>
      <div className="divide-y">
        {entries.map((e) => (
          <div key={e.timestamp} className="flex items-center justify-between py-1.5 text-xs">
            <div className="min-w-0">
              <span className="font-mono font-semibold">{e.location}</span>
              <span className="text-muted-foreground ml-2">{e.codes.length} kodów</span>
            </div>
            <button
              onClick={() => onUndo(e)}
              disabled={loading}
              className="touch-target inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-accent text-destructive disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" />
              Cofnij
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
