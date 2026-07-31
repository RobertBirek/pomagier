import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState, useEffect } from "react";
import { toast } from "sonner";
import { ScanHeader } from "@/components/pomagier/ScanHeader";
import { addScanToQueue } from "@/lib/offline-queue";
import { useScanBasket, type BasketItem } from "@/lib/scan-basket";
import { BasketHeader } from "@/components/pomagier/primitives";
import { Package, MapPin, Trash2, Barcode, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/mobile/scan")({ component: ScanPage });

function ScanPage() {
  const nav = useNavigate();
  const { items, addItem, removeItem, clearBasket } = useScanBasket();

  const handleSubmit = useCallback(
    async (code: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/scan-basket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        if (!res.ok) {
          await addScanToQueue(code);
          toast.warning("Offline — zapisano w kolejce", { description: code });
          return false;
        }

        const data = (await res.json()) as { type: string; code: string };

        if (data.type === "not_found") {
          toast.error("Nie znaleziono", { description: code });
          return false;
        }

        addItem(data as BasketItem);
        return true;
      } catch {
        await addScanToQueue(code);
        toast.warning("Offline — zapisano w kolejce", { description: code });
        return false;
      }
    },
    [addItem],
  );

  const handleOpenItem = (item: BasketItem) => {
    if (item.type === "product") {
      nav({ to: "/mobile/product/$code", params: { code: item.barcode || item.code } });
    } else {
      nav({ to: "/mobile/location/$code", params: { code: item.code } });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <ScanHeader
        onSubmit={handleSubmit}
        hint="🟢 Zeskanuj kod — wynik zostanie dodany do koszyka"
      />

      <div className="flex-1 p-3 space-y-3">
        {items.length > 0 && (
          <div className="rounded-lg border bg-card">
            <BasketHeader count={items.length} onClear={clearBasket} />

            {items.map((item, i) =>
              item.type === "product" ? (
                <ScanProductRow
                  key={`product-${item.code}-${i}`}
                  item={item}
                  onOpen={() => handleOpenItem(item)}
                  onRemove={() => removeItem(i)}
                />
              ) : (
                <div key={`location-${item.code}-${i}`} className="flex items-center border-t">
                  <button
                    onClick={() => handleOpenItem(item)}
                    className="flex-1 min-w-0 p-4 text-left hover:bg-accent active:scale-[0.98] transition-all touch-target"
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold">{item.code}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.productCount && item.productCount > 0
                            ? `${item.productCount} ${item.productCount === 1 ? "produkt" : item.productCount < 5 ? "produkty" : "produktów"}`
                            : "Brak produktów"}
                        </div>
                      </div>
                    </div>
                  </button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(i);
                    }}
                    className="shrink-0 touch-target p-3 text-destructive/60 hover:text-destructive hover:bg-destructive/5 transition-colors"
                    aria-label="Usuń z koszyka"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            )}
          </div>
        )}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-16 w-16 text-muted-foreground/15 mb-4" />
            <p className="text-sm text-muted-foreground">Zeskanuj kod aby dodać do koszyka</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Kody EAN, symbole towarów lub kody lokalizacji
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Product row with lazy stock fetch ── */

interface ProductStockSummary {
  total: number;
  reserved: number;
}

function ScanProductRow({
  item,
  onOpen,
  onRemove,
}: {
  item: {
    code: string;
    barcode?: string;
    symbol?: string;
    name?: string;
    locations?: { code: string }[];
  };
  onOpen: () => void;
  onRemove: () => void;
}) {
  const [stocks, setStocks] = useState<ProductStockSummary | null>(null);
  const [stockLoaded, setStockLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: item.barcode || item.code }),
    })
      .then((r) => r.json())
      .then((data) => {
        const s = data.products?.[0]?.stocks;
        if (s?.length) {
          const total = s.reduce(
            (sum: number, st: { quantity: number; reserved: number }) => sum + st.quantity,
            0,
          );
          const reserved = s.reduce(
            (sum: number, st: { quantity: number; reserved: number }) => sum + st.reserved,
            0,
          );
          setStocks({ total, reserved });
        }
      })
      .catch(() => {})
      .finally(() => setStockLoaded(true));
  }, [item.code, item.barcode]);

  const hasStock = stocks !== null;
  const available = stocks ? stocks.total - stocks.reserved : 0;

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-start gap-2 px-3 py-2 text-sm border-t">
      {/* Left — product info */}
      <button
        onClick={onOpen}
        className="min-w-0 text-left hover:bg-accent active:scale-[0.98] transition-all touch-target"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Barcode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono font-semibold text-[13px] leading-tight truncate">
              {item.barcode || item.code}
            </span>
          </div>
          {item.name && <div className="text-xs text-muted-foreground truncate">{item.name}</div>}
          {item.locations && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {item.locations.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {item.locations.slice(0, 3).map((loc) => (
                    <span
                      key={loc.code}
                      className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-mono"
                    >
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {loc.code}
                    </span>
                  ))}
                  {item.locations.length > 3 && (
                    <span className="text-xs text-muted-foreground self-center">
                      +{item.locations.length - 3}
                    </span>
                  )}
                </span>
              ) : (
                <span>
                  <MapPin className="inline h-3 w-3" /> brak
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      {/* Middle — stock summary */}
      {stockLoaded && hasStock && (
        <div className="text-xs tabular-nums font-mono leading-snug text-right self-start">
          <div className="text-muted-foreground">S:{stocks.total}</div>
          <div className="text-amber-600">R:{stocks.reserved}</div>
          <div className="text-emerald-600">D:{available}</div>
        </div>
      )}

      {/* Right — chevron + remove */}
      <div className="flex items-center self-center">
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 touch-target p-3 text-destructive/60 hover:text-destructive hover:bg-destructive/5 transition-colors"
          aria-label="Usuń z koszyka"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
