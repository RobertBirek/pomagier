import { Package, X, Trash2 } from "lucide-react";
import type { BasketItem } from "@/hooks/use-basket";

interface BasketPanelProps {
  items: BasketItem[];
  totalQty: number;
  onUpdateQty: (code: string, delta: number) => void;
  onRemove: (code: string) => void;
  onClear: () => void;
}

export function BasketPanel({ items, totalQty, onUpdateQty, onRemove, onClear }: BasketPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-semibold">Koszyk ({totalQty} szt.)</span>
        <button onClick={onClear} className="touch-target text-xs text-destructive hover:underline">
          <Trash2 className="mr-1 inline h-3 w-3" />
          Wyczyść
        </button>
      </div>
      <div className="divide-y max-h-64 overflow-y-auto">
        {items.map((item) => (
          <div key={item.code} className="flex items-center justify-between px-4 py-2 text-sm">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="font-mono text-xs truncate">{item.code}</span>
                {item.name && (
                  <span className="text-xs text-muted-foreground ml-1.5 truncate">{item.name}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onUpdateQty(item.code, -1)}
                className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-accent font-mono"
              >
                −
              </button>
              <span className="w-5 text-center font-mono text-xs font-semibold">{item.qty}</span>
              <button
                onClick={() => onUpdateQty(item.code, 1)}
                className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-accent font-mono"
              >
                +
              </button>
              <button
                onClick={() => onRemove(item.code)}
                className="touch-target rounded p-1 hover:bg-accent ml-1"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
