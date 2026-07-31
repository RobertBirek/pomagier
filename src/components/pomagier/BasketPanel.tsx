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
import { ChevronRight, MapPin, Barcode } from "lucide-react";
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
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const [showQty, setShowQty] = useState(false);

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
      .catch(() => {})
      .finally(() => setLocationsLoaded(true));
  }, [item.code, onNavigate]);

  const handleClick = () => {
    if (onNavigate) onNavigate(item.code);
  };

  // Compute stock summary if available
  const stocks = item.stocks;
  const totalStock = stocks ? stocks.reduce((s, st) => s + st.quantity, 0) : 0;
  const totalReserved = stocks ? stocks.reduce((s, st) => s + st.reserved, 0) : 0;
  const totalAvailable = totalStock - totalReserved;
  const hasStockData = stocks && stocks.length > 0;

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-start gap-2 px-4 py-2 text-sm">
      {/* Left — product info */}
      <button onClick={handleClick} className="min-w-0 text-left">
        <div className="font-mono font-semibold text-[13px] break-all leading-tight truncate flex items-center gap-1.5">
          <Barcode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {item.code}
        </div>
        {item.name && <div className="text-xs text-muted-foreground truncate">{item.name}</div>}
        {locationsLoaded && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            <MapPin className="inline h-3 w-3" />{" "}
            {locations.length > 0 ? locations.map((l) => l.code).join(", ") : "brak"}
          </div>
        )}
      </button>

      {/* Middle — stock summary */}
      {hasStockData && (
        <div className="text-xs tabular-nums font-mono leading-snug text-right self-start">
          <div className="text-muted-foreground">S:{totalStock}</div>
          <div className="text-amber-600">R:{totalReserved}</div>
          <div className="text-emerald-600">D:{totalAvailable}</div>
        </div>
      )}

      {/* Right — chevron + qty box */}
      <div className="flex items-center gap-1.5 self-center relative">
        {onNavigate && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowQty(!showQty);
          }}
          className="min-w-[2rem] h-6 rounded border bg-muted/30 px-1.5 text-xs font-mono font-semibold tabular-nums hover:bg-muted/50 transition-colors"
        >
          {item.qty}
        </button>
      </div>

      {/* Qty edit popup */}
      {showQty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={(e) => {
            e.stopPropagation();
            setShowQty(false);
          }}
        >
          <div
            className="rounded-lg border bg-card p-4 shadow-xl flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                beep(400, 80);
                haptic(30);
                if (item.qty <= 1) {
                  onConfirmRemove(item);
                  setShowQty(false);
                } else {
                  onUpdateQty(item.code, -1);
                }
              }}
              className="touch-target rounded border px-2 py-0.5 text-sm hover:bg-destructive/10 font-mono text-destructive border-destructive/30"
            >
              −
            </button>
            <span className="w-6 text-center font-mono text-sm font-semibold tabular-nums">
              {item.qty}
            </span>
            <button
              onClick={() => {
                beep(1000, 60);
                haptic(30);
                onUpdateQty(item.code, 1);
              }}
              className="touch-target rounded border px-2 py-0.5 text-sm hover:bg-success/10 font-mono text-success border-success/30"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
