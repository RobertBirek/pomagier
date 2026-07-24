import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { parseLocation } from "@/lib/locations";
import { addScanToQueue } from "@/lib/offline-queue";
import { MapPin, Package, X, CheckCircle2, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/pomagier/primitives";

async function assignProducts(codes: string[], location: string) {
  const res = await fetch("/api/locations/assign", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codes, location }),
  });
  return res.json();
}

interface BasketItem {
  code: string;
  name?: string;
  qty: number;
}

export const Route = createFileRoute("/mobile/locations")({
  component: LocationsPage,
});

function LocationsPage() {
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refocus = () => setTimeout(() => inputRef.current?.focus(), 50);

  useEffect(() => { refocus(); }, []);

  // Always refocus on any interaction
  useEffect(() => {
    const handler = () => refocus();
    document.addEventListener("click", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const addToBasket = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Check if it's a location code
    const loc = parseLocation(trimmed);
    if (loc) {
      if (basket.length === 0) {
        toast.error("Najpierw zeskanuj towary");
        return;
      }
      setPendingLocation(loc.raw);
      return;
    }

    // Check if already in basket
    const existing = basket.find((b) => b.code === trimmed);
    if (existing) {
      setBasket((b) => b.map((item) => (item.code === trimmed ? { ...item, qty: item.qty + 1 } : item)));
    } else {
      setBasket((b) => [...b, { code: trimmed, qty: 1 }]);
    }

    toast.success(`Dodano: ${trimmed}`, { duration: 800 });
    setInputValue("");
    refocus();
  };

  const handleSubmit = () => addToBasket(inputValue);

  const removeItem = (code: string) => {
    setBasket((b) => b.filter((item) => item.code !== code));
    refocus();
  };

  const handleSave = async () => {
    if (!pendingLocation || basket.length === 0) return;
    setSaving(true);
    try {
      const codes = basket.flatMap((b) => Array(b.qty).fill(b.code));
      const result = await assignProducts(codes, pendingLocation);
      if (result.ok) {
        toast.success(
          <div>
            <CheckCircle2 className="inline h-4 w-4 mr-1" />
            Przypisano {result.totalQuantity} towarów do {result.location}
          </div>,
          { duration: 3000 },
        );
        setBasket([]);
      } else {
        toast.error(result.error || "Błąd");
        if (result.notFound?.length) {
          toast.error(`Nie znaleziono: ${result.notFound.join(", ")}`);
        }
      }
    } catch (e: any) {
      toast.error(e.message);
      // Queue offline
      for (const item of basket) {
        await addScanToQueue(item.code, pendingLocation);
      }
      toast.warning("Offline — zapisano w kolejce", { description: `${basket.length} skanów` });
    } finally {
      setSaving(false);
      setPendingLocation(null);
      refocus();
    }
  };

  const totalQty = basket.reduce((sum, b) => sum + b.qty, 0);

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-lg font-bold">Przypisz towary</h1>

      {/* Input */}
      <div>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder="Zeskanuj EAN towaru..."
          autoComplete="off"
          className="w-full rounded-lg border-2 border-primary/40 bg-background px-4 py-5 text-center text-lg font-mono shadow-inner outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
        />
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {basket.length === 0
            ? "Skanuj towary (Enter), potem zeskanuj lokalizację"
            : `Koszyk: ${totalQty} szt. — teraz zeskanuj lokalizację`}
        </p>
      </div>

      {/* Basket */}
      {basket.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <span className="text-sm font-semibold">Koszyk ({totalQty} szt.)</span>
            <button onClick={() => setBasket([])} className="touch-target text-xs text-destructive hover:underline">
              <Trash2 className="mr-1 inline h-3 w-3" />Wyczyść
            </button>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {basket.map((item) => (
              <div key={item.code} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs truncate">{item.code}</span>
                  {item.name && <span className="text-xs text-muted-foreground truncate">{item.name}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.qty > 1 && <StatusBadge tone="warning">×{item.qty}</StatusBadge>}
                  <button onClick={() => removeItem(item.code)} className="touch-target rounded p-1 hover:bg-accent">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation card — shown after location scanned */}
      {pendingLocation && (
        <div className="rounded-lg border-2 border-success bg-success/5 p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Potwierdź przypisanie</div>
              <div className="mt-1 font-mono text-lg font-bold">{pendingLocation}</div>
              <div className="text-xs text-muted-foreground mt-1">{totalQty} towarów do przypisania</div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 flex-1 justify-center"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Zapisuję…" : "Zapisz"}
                </button>
                <button onClick={() => { setPendingLocation(null); refocus(); }} className="touch-target rounded-md border px-4 py-2.5 text-sm">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {basket.length === 0 && !pendingLocation && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
          <p className="text-sm">Zeskanuj EAN towaru aby dodać do koszyka</p>
          <p className="text-xs mt-1">Następnie zeskanuj kod lokalizacji aby zapisać</p>
        </div>
      )}
    </div>
  );
}
