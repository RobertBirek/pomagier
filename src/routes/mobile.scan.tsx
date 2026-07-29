import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ScanHeader } from "@/components/pomagier/ScanHeader";
import { parseLocation } from "@/lib/locations";
import { addScanToQueue } from "@/lib/offline-queue";
import { ChevronRight, Package, MapPin } from "lucide-react";
import type { ProductInfo } from "@/erp/types";

interface ScanResultItem {
  code: string;
  type: "product" | "location";
  name?: string;
  stocks?: { warehouseName: string; quantity: number }[];
  location?: string;
  locationLabel?: string;
}

export const Route = createFileRoute("/mobile/scan")({ component: ScanPage });

function ScanPage() {
  const nav = useNavigate();
  const [lastResult, setLastResult] = useState<ScanResultItem | null>(null);

  const handleSubmit = useCallback(async (code: string): Promise<boolean> => {
    setLastResult(null);

    const loc = parseLocation(code);
    if (loc) {
      setLastResult({
        code,
        type: "location",
        location: loc.raw,
        locationLabel: loc.label,
      });
      return true;
    }

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const data: { found: boolean; barcode: string; products: ProductInfo[] } = await res.json();
        if (data.found) {
          const product = data.products[0];
          setLastResult({
            code,
            type: "product",
            name: product.name,
            stocks: product.stocks.map((s) => ({
              warehouseName: s.warehouseName,
              quantity: s.quantity,
            })),
            location: product.description || undefined,
          });
          return true;
        } else {
          toast.error("Nie znaleziono", { description: code });
          return false;
        }
      }
      return false;
    } catch {
      await addScanToQueue(code);
      toast.warning("Offline — zapisano w kolejce", { description: code });
      return false;
    }
  }, []);

  const handleOpenProduct = () => {
    if (lastResult?.type === "product") {
      nav({ to: "/mobile/product/$code", params: { code: lastResult.code } });
    } else if (lastResult?.type === "location") {
      nav({ to: "/mobile/location/$code", params: { code: lastResult.location! } });
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <ScanHeader onSubmit={handleSubmit} hint="🟢 Zeskanuj kod — wynik pokaże się poniżej" />

      <div className="flex-1 p-4 space-y-4">
        {/* Inline result */}
        {lastResult && (
          <button
            onClick={handleOpenProduct}
            className="w-full rounded-lg border bg-card p-4 text-left hover:bg-accent active:scale-[0.98] transition-all touch-target"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {lastResult.type === "product" ? (
                  <Package className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                ) : (
                  <MapPin className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground mb-0.5">
                    {lastResult.code}
                  </div>
                  {lastResult.type === "product" ? (
                    <>
                      <div className="font-semibold text-sm truncate">{lastResult.name}</div>
                      {lastResult.stocks && lastResult.stocks.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {lastResult.stocks.slice(0, 2).map((s, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                            >
                              <span className="text-muted-foreground">{s.warehouseName}:</span>
                              <span className="font-semibold">{s.quantity} szt.</span>
                            </span>
                          ))}
                          {lastResult.stocks.length > 2 && (
                            <span className="text-xs text-muted-foreground self-center">
                              +{lastResult.stocks.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="font-semibold text-sm">
                      Lokalizacja: {lastResult.locationLabel}
                    </div>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />
            </div>
          </button>
        )}

        {/* Empty state */}
        {!lastResult && (
          <div className="flex items-center justify-center py-8">
            <Package className="h-16 w-16 text-muted-foreground/15" />
          </div>
        )}
      </div>
    </div>
  );
}
