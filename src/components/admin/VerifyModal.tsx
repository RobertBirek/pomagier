import type { VerifyDetail, VerifyResult } from "@/routes/admin.map";
import { X } from "lucide-react";

interface VerifyModalProps {
  verifyResult: VerifyResult;
  selectedProducts: Set<number>;
  fixPending: boolean;
  subiektPending: boolean;
  clearPending: boolean;
  batchPending: boolean;
  onClose: () => void;
  onToggleProduct: (id: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchFix: (ids: number[], dir: string) => void;
  onFixAll: () => void;
  onSubiektAll: () => void;
  onClearAll: () => void;
}

export function VerifyModal({
  verifyResult,
  selectedProducts,
  fixPending,
  subiektPending,
  clearPending,
  batchPending,
  onClose,
  onToggleProduct,
  onSelectAll,
  onDeselectAll,
  onBatchFix,
  onFixAll,
  onSubiektAll,
  onClearAll,
}: VerifyModalProps) {
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
            <h2 className="text-lg font-bold">Weryfikacja spójności</h2>
            <p className="text-xs text-muted-foreground">Postgres vs Subiekt GT (tw_Pole1)</p>
          </div>
          <button
            onClick={() => {
              onClose();
              onDeselectAll();
            }}
            className="rounded p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded bg-muted/50 p-3 text-center">
            <div className="text-2xl font-bold">{verifyResult.totalProducts}</div>
            <div className="text-xs text-muted-foreground">Produktów</div>
          </div>
          <div className="rounded bg-green-50 p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{verifyResult.synced}</div>
            <div className="text-xs text-green-600">Zgodnych</div>
          </div>
          <div className="rounded bg-amber-50 p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{verifyResult.mismatches}</div>
            <div className="text-xs text-amber-600">Rozbieżności</div>
          </div>
        </div>

        {verifyResult.mismatches > 0 && (
          <>
            <div className="text-sm font-semibold mb-2 flex items-center justify-between">
              <span>Szczegóły ({verifyResult.details.length})</span>
              <div className="flex gap-1">
                <button onClick={onSelectAll} className="text-xs underline">
                  Zaznacz wszystkie
                </button>
                <button onClick={onDeselectAll} className="text-xs underline">
                  Odznacz
                </button>
              </div>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
              {verifyResult.details.map((d: VerifyDetail) => {
                const sel = selectedProducts.has(d.productId);
                return (
                  <label
                    key={d.productId}
                    className={`flex items-start gap-2 rounded border p-2 text-xs cursor-pointer hover:bg-muted/30 ${sel ? "border-primary bg-primary/5" : "bg-muted/20"}`}
                  >
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => onToggleProduct(d.productId)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">ID {d.productId}</div>
                      <div className="flex gap-4 mt-0.5">
                        <div>
                          <span className="text-muted-foreground">Postgres:</span>{" "}
                          <span className="font-mono">
                            {d.postgres.length > 0 ? d.postgres.join(", ") : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Subiekt:</span>{" "}
                          <span className="font-mono">
                            {d.subiekt.length > 0 ? d.subiekt.join(", ") : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {selectedProducts.size > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  onClick={() => onBatchFix([...selectedProducts], "postgres-to-subiekt")}
                  disabled={batchPending}
                  className="rounded-md bg-primary py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Subiekt ← Postgres
                </button>
                <button
                  onClick={() => onBatchFix([...selectedProducts], "subiekt-to-postgres")}
                  disabled={batchPending}
                  className="rounded-md border py-2 text-xs disabled:opacity-50"
                >
                  Postgres ← Subiekt
                </button>
                <button
                  onClick={() => onBatchFix([...selectedProducts], "clear")}
                  disabled={batchPending}
                  className="rounded-md border border-destructive/30 py-2 text-xs text-destructive disabled:opacity-50"
                >
                  ✕ Wyczyść ({selectedProducts.size})
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={onFixAll}
                disabled={fixPending}
                className="rounded-md bg-primary py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {fixPending ? "…" : "Subiekt ← Postgres (all)"}
              </button>
              <button
                onClick={onSubiektAll}
                disabled={subiektPending}
                className="rounded-md border py-2 text-xs hover:bg-accent disabled:opacity-50"
              >
                {subiektPending ? "…" : "Postgres ← Subiekt (all)"}
              </button>
              <button
                onClick={onClearAll}
                disabled={clearPending}
                className="rounded-md border border-destructive/30 py-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {clearPending ? "…" : "✕ Wyczyść (all)"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Wybierz źródło prawdy: Postgres (dane z PomagierGT) lub Subiekt GT (dane z ERP)
            </p>
          </>
        )}

        {verifyResult.mismatches === 0 && (
          <div className="text-center py-4 text-green-600 font-semibold">
            ✅ Wszystkie produkty zgodne — synchronizacja OK
          </div>
        )}
      </div>
    </div>
  );
}
