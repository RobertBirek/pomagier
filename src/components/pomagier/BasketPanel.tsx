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
import { Trash2, X, Loader2 } from "lucide-react";
import type { BasketItem } from "@/hooks/use-basket";
import type { StockInfo } from "@/erp/types";
import { beep, haptic } from "@/lib/utils";

interface BasketPanelProps {
  items: BasketItem[];
  totalQty: number;
  onUpdateQty: (code: string, delta: number) => void;
  onRemove: (code: string) => void;
  onClear: () => void;
}

export function BasketPanel({ items, totalQty, onUpdateQty, onRemove, onClear }: BasketPanelProps) {
  const [confirmRemove, setConfirmRemove] = useState<BasketItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<BasketItem | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-semibold">Koszyk ({totalQty} szt.)</span>
        <button
          onClick={onClear}
          className="touch-target text-xs text-destructive hover:underline inline-flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Wyczyść
        </button>
      </div>

      {/* Items */}
      <div className="divide-y max-h-64 overflow-y-auto">
        {items.map((item) => (
          <BasketRow
            key={item.code}
            item={item}
            onUpdateQty={onUpdateQty}
            onConfirmRemove={setConfirmRemove}
            onSelect={setSelectedItem}
          />
        ))}
      </div>

      {/* Confirm removal dialog */}
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

      {/* Product stock detail modal */}
      {selectedItem && (
        <StockDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

/* ── Single basket row ── */

function BasketRow({
  item,
  onUpdateQty,
  onConfirmRemove,
  onSelect,
}: {
  item: BasketItem;
  onUpdateQty: (code: string, delta: number) => void;
  onConfirmRemove: (item: BasketItem) => void;
  onSelect: (item: BasketItem) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm">
      {/* Column 1 — clickable EAN + name */}
      <button onClick={() => onSelect(item)} className="flex-1 min-w-0 text-left cursor-pointer">
        <div className="font-mono font-semibold text-[13px] break-all leading-tight">
          {item.code}
        </div>
        {item.name && <div className="text-xs text-muted-foreground truncate">{item.name}</div>}
      </button>

      {/* Column 2 — [-] qty [+] */}
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

/* ── Stock detail modal ── */

function StockDetailModal({ item, onClose }: { item: BasketItem; onClose: () => void }) {
  const [stocks, setStocks] = useState<StockInfo[] | null>(
    item.stocks && item.stocks.length > 0 ? item.stocks : null,
  );
  const [loading, setLoading] = useState(!stocks);

  useEffect(() => {
    if (stocks) return;
    setLoading(true);
    fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: item.code }),
    })
      .then((r) => r.json())
      .then((data) => setStocks(data.products?.[0]?.stocks ?? []))
      .catch(() => setStocks([]))
      .finally(() => setLoading(false));
  }, [item.code, stocks]);

  const stockList = stocks ?? [];
  const totalStan = stockList.reduce((s, st) => s + st.quantity, 0);
  const totalRez = stockList.reduce((s, st) => s + st.reserved, 0);
  const totalAvail = totalStan - totalRez;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-xl bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold">Stan magazynowy</span>
          <button onClick={onClose} className="touch-target rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Product info */}
        <div className="mb-3">
          {item.name && <div className="font-semibold text-sm">{item.name}</div>}
          <div className="font-mono text-xs text-muted-foreground break-all mt-0.5">
            {item.code}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Ładowanie danych magazynowych...
          </div>
        )}

        {/* Error / no data */}
        {!loading && stockList.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Brak danych o stanie magazynowym
          </p>
        )}

        {/* Per-warehouse stocks */}
        {!loading && stockList.length > 0 && (
          <div className="space-y-2">
            {stockList.map((st) => {
              const avail = st.quantity - st.reserved;
              return (
                <div
                  key={st.warehouseId}
                  className="rounded-lg border bg-muted/20 px-3 py-2 text-xs space-y-1"
                >
                  <div className="font-semibold text-sm">
                    {st.warehouseSymbol} — {st.warehouseName}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                    <span>
                      Stan: <b className="text-foreground">{st.quantity}</b>
                    </span>
                    <span>
                      Rezerwacja: <b className="text-foreground">{st.reserved}</b>
                    </span>
                    <span>
                      Dostępne: <b className="text-foreground">{avail}</b>
                    </span>
                    <span>
                      Min / Max:{" "}
                      <b className="text-foreground">
                        {st.minQuantity} / {st.maxQuantity}
                      </b>
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Totals */}
            <div className="rounded-lg border bg-primary/5 px-3 py-2 text-xs">
              <div className="font-semibold text-sm mb-0.5">Razem</div>
              <div className="flex gap-4 text-muted-foreground">
                <span>
                  Stan: <b className="text-foreground">{totalStan}</b>
                </span>
                <span>
                  Rez.: <b className="text-foreground">{totalRez}</b>
                </span>
                <span>
                  Dost.: <b className="text-foreground">{totalAvail}</b>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
