import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronRight, MapPin } from "lucide-react";
import type { BasketItem } from "@/hooks/use-basket";
import { beep, haptic } from "@/lib/utils";
import { BasketHeader } from "./primitives";

interface BasketPanelProps {
  items: BasketItem[];
  totalQty: number;
  onUpdateQty: (code: string, delta: number) => void;
  onRemove: (code: string) => void;
  onClear: () => void;
  onNavigate?: (code: string) => void;
}

export function BasketPanel({
  items,
  totalQty,
  onUpdateQty,
  onRemove,
  onClear,
  onNavigate,
}: BasketPanelProps) {
  const [confirmRemove, setConfirmRemove] = useState<BasketItem | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card">
      <BasketHeader count={totalQty} onClear={onClear} />

      <div className="divide-y max-h-64 overflow-y-auto">
        {items.map((item) => (
          <BasketRow
            key={item.code}
            item={item}
            onUpdateQty={onUpdateQty}
            onConfirmRemove={setConfirmRemove}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <AlertDialog
        open={confirmRemove !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRemove(null);
        }}
      >
        <AlertDialogContent className="max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle>Czy usunąć towar z listy?</AlertDialogTitle>
            {confirmRemove && (
              <AlertDialogDescription className="font-mono break-all">
                {confirmRemove.code}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemove) onRemove(confirmRemove.code);
                setConfirmRemove(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Single basket row ── */

function BasketRow({
  item,
  onUpdateQty,
  onConfirmRemove,
  onNavigate,
}: {
  item: BasketItem;
  onUpdateQty: (code: string, delta: number) => void;
  onConfirmRemove: (item: BasketItem) => void;
  onNavigate?: (code: string) => void;
}) {
  const [locations, setLocations] = useState<{ code: string }[]>([]);

  useEffect(() => {
    if (!onNavigate) return;
    fetch("/api/scan-basket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: item.code }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.type === "product") setLocations(data.locations || []);
      })
      .catch(() => {});
  }, [item.code, onNavigate]);

  const handleClick = () => {
    if (onNavigate) onNavigate(item.code);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm">
      <button onClick={handleClick} className="flex-1 min-w-0 text-left">
        <div className="font-mono font-semibold text-[13px] break-all leading-tight">
          {item.code}
        </div>
        {item.name && <div className="text-xs text-muted-foreground truncate">{item.name}</div>}
        {locations.length > 0 && (
          <div className="text-xs text-muted-foreground truncate font-mono mt-0.5">
            <MapPin className="inline h-3 w-3" /> {locations.map((l) => l.code).join(", ")}
          </div>
        )}
      </button>

      {onNavigate && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => {
            beep(400, 80);
            haptic(30);
            if (item.qty <= 1) {
              onConfirmRemove(item);
            } else {
              onUpdateQty(item.code, -1);
            }
          }}
          className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-destructive/10 font-mono text-destructive border-destructive/30"
        >
          −
        </button>
        <span className="w-5 text-center font-mono text-xs font-semibold tabular-nums">
          {item.qty}
        </span>
        <button
          onClick={() => {
            beep(1000, 60);
            haptic(30);
            onUpdateQty(item.code, 1);
          }}
          className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-success/10 font-mono text-success border-success/30"
        >
          +
        </button>
      </div>
    </div>
  );
}
