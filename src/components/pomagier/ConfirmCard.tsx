import { MapPin, CheckCircle2, X, ArrowRightLeft } from "lucide-react";

interface ConfirmCardProps {
  variant: "assign" | "transfer" | "reset";
  /** Primary location (target for assign, destination for transfer, reset target) */
  location: string;
  /** Secondary location (source for transfer only) */
  sourceLocation?: string;
  totalQty: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmCard({
  variant,
  location,
  sourceLocation,
  totalQty,
  loading,
  onConfirm,
  onCancel,
}: ConfirmCardProps) {
  if (variant === "reset") {
    return (
      <div className="rounded-lg border-2 border-orange-400 bg-orange-50 p-4">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 text-orange-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-orange-800">Potwierdź reset</div>
            <div className="mt-1 font-mono text-lg font-bold">{location}</div>
            <div className="text-xs text-muted-foreground mt-1">
              ⚠️ Usuwa wszystkie inne lokalizacje dla {totalQty} towarów
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="touch-target inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50 flex-1 justify-center"
              >
                {loading ? "Resetuję…" : "Resetuj"}
              </button>
              <button
                onClick={onCancel}
                className="touch-target rounded-md border px-4 py-2.5 text-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "transfer") {
    return (
      <div className="rounded-lg border-2 border-success bg-success/5 p-4 animate-in slide-in-from-bottom-2">
        <div className="flex items-start gap-3">
          <ArrowRightLeft className="mt-0.5 h-5 w-5 text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Potwierdź przeniesienie</div>
            <div className="mt-1 font-mono text-sm">
              <span className="text-muted-foreground">{sourceLocation}</span>
              <span className="mx-1">→</span>
              <span className="font-bold">{location}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">{totalQty} towarów</div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 flex-1 justify-center"
              >
                <CheckCircle2 className="h-4 w-4" />
                {loading ? "Przenoszę…" : "Wykonaj"}
              </button>
              <button
                onClick={onCancel}
                className="touch-target rounded-md border px-4 py-2.5 text-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // variant === "assign"
  return (
    <div className="rounded-lg border-2 border-success bg-success/5 p-4 animate-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 text-success shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Potwierdź przypisanie</div>
          <div className="mt-1 font-mono text-lg font-bold">{location}</div>
          <div className="text-xs text-muted-foreground mt-1">{totalQty} towarów</div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onConfirm}
              disabled={loading}
              className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 flex-1 justify-center"
            >
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "Zapisuję…" : "Zapisz"}
            </button>
            <button
              onClick={onCancel}
              className="touch-target rounded-md border px-4 py-2.5 text-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
