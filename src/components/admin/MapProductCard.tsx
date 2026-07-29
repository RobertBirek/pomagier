import type { CellProduct } from "@/routes/admin.map";
import { LoadingRow } from "@/components/pomagier/primitives";
import { X } from "lucide-react";

interface MapProductCardProps {
  cellDetail: { code: string; products: CellProduct[] } | null;
  loading: boolean;
  onClose: () => void;
}

export function MapProductCard({ cellDetail, loading, onClose }: MapProductCardProps) {
  if (!cellDetail) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{cellDetail.code}</h2>
            <p className="text-xs text-muted-foreground">{cellDetail.products.length} produktów</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <LoadingRow />
        ) : cellDetail.products.length > 0 ? (
          <div className="space-y-2">
            {cellDetail.products.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded border bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold">{p.symbol}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.name}</div>
                  {p.barcode && (
                    <div className="text-xs text-muted-foreground font-mono">EAN: {p.barcode}</div>
                  )}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-xs text-muted-foreground">{p.unit}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Brak produktów w tej lokalizacji</p>
        )}
      </div>
    </div>
  );
}
