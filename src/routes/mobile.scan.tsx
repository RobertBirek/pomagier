import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";
import { ScanHeader } from "@/components/pomagier/ScanHeader";
import { addScanToQueue } from "@/lib/offline-queue";
import { useScanBasket, type BasketItem } from "@/lib/scan-basket";
import { ChevronRight, Package, MapPin, Trash2, Barcode } from "lucide-react";

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
          // Offline fallback
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

      <div className="flex-1 p-4 space-y-3">
        {/* Basket items */}
        {items.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Koszyk ({items.length})
              </span>
              <button
                onClick={clearBasket}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive touch-target rounded px-2 py-1"
              >
                <Trash2 className="h-3 w-3" />
                Wyczyść
              </button>
            </div>

            {items.map((item, i) => (
              <div key={`${item.type}-${item.code}-${i}`} className="group relative">
                <button
                  onClick={() => handleOpenItem(item)}
                  className="w-full rounded-lg border bg-card p-4 text-left hover:bg-accent active:scale-[0.98] transition-all touch-target"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {item.type === "product" ? (
                        <Package className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      ) : (
                        <MapPin className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        {/* Code line */}
                        {item.type === "product" ? (
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Barcode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-mono text-sm font-bold truncate">
                              {item.barcode || item.code}
                            </span>
                          </div>
                        ) : (
                          <div className="font-mono text-xs text-muted-foreground mb-0.5">
                            {item.code}
                          </div>
                        )}

                        {/* Name / description */}
                        {item.type === "product" ? (
                          <>
                            <div className="text-sm truncate">{item.name}</div>
                            <div className="font-mono text-xs text-muted-foreground mt-0.5">
                              {item.symbol}
                            </div>
                            {item.locations && item.locations.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
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
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="font-semibold text-sm">{item.code}</div>
                        )}

                        {/* Meta line */}
                        {item.type === "location" && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.productCount > 0
                              ? `${item.productCount} ${item.productCount === 1 ? "produkt" : item.productCount < 5 ? "produkty" : "produktów"}`
                              : "Brak produktów"}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />
                  </div>
                </button>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(i);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 touch-target rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  aria-label="Usuń z koszyka"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
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
