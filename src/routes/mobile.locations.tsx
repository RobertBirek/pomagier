import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { parseLocation } from "@/lib/locations";
import { addScanToQueue } from "@/lib/offline-queue";
import { MapPin, Package, X, CheckCircle2, Trash2, History, RotateCcw } from "lucide-react";

async function assignProducts(codes: string[], location: string) {
  const res = await fetch("/api/locations/assign", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codes, location }),
  });
  return res.json();
}

async function lookupProduct(code: string) {
  try {
    const res = await fetch("/api/scan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.products?.[0];
    }
  } catch {}
  return null;
}

// Sound effects
function beep(freq: number, duration = 120) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = "square";
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(); osc.stop(ctx.currentTime + duration / 1000);
  } catch {}
}

interface BasketItem { code: string; name?: string; qty: number; }
interface HistoryEntry { codes: string[]; location: string; timestamp: number; products: { id: number; symbol: string }[]; }

const LAST_LOC_KEY = "pomagier-last-location";

export const Route = createFileRoute("/mobile/locations")({ component: LocationsPage });

function LocationsPage() {
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [lastLocation, setLastLocation] = useState<string | null>(() => localStorage.getItem(LAST_LOC_KEY));
  const [stepQty, setStepQty] = useState<{ code: string; qty: number } | null>(null);
  const [suggestions, setSuggestions] = useState<{ code: string; name: string; barcode: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refocus = () => setTimeout(() => inputRef.current?.focus(), 50);
  useEffect(() => { refocus(); }, []);
  useEffect(() => {
    const handler = () => refocus();
    document.addEventListener("click", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("click", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  // Visual mode: green = scanning products, blue = waiting for location
  const mode: "scan" | "locate" = basket.length > 0 && !pendingLocation ? "locate" : "scan";
  const inputBorderClass = mode === "locate"
    ? "border-blue-400 focus:border-blue-500 focus:ring-blue-500/20"
    : "border-primary/40 focus:border-primary focus:ring-primary/20";

  const totalQty = basket.reduce((s, b) => s + b.qty, 0);

  const addToBasket = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    beep(800, 100);

    const loc = parseLocation(trimmed);
    if (loc) {
      if (basket.length === 0) { toast.error("Najpierw zeskanuj towary"); beep(200, 300); return; }
      setPendingLocation(loc.raw);
      setLastLocation(loc.raw); localStorage.setItem(LAST_LOC_KEY, loc.raw);
      return;
    }

    // Check duplicate
    const existing = basket.find(b => b.code === trimmed);
    if (existing) {
      setBasket(b => b.map(i => i.code === trimmed ? { ...i, qty: i.qty + 1 } : i));
    } else {
      // Lookup product name
      const product = await lookupProduct(trimmed);
      setBasket(b => [...b, { code: trimmed, name: product?.name, qty: 1 }]);
    }
    toast.success(`Dodano: ${trimmed}`, { duration: 800 });
    setInputValue(""); refocus();
  };

  const handleSubmit = () => addToBasket(inputValue);

  // Auto-complete debounce
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    searchTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/products/quick-search?q=${encodeURIComponent(value.trim())}`);
      const data = await res.json();
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    }, 200);
  }, []);

  const removeItem = (code: string) => { setBasket(b => b.filter(i => i.code !== code)); refocus(); };

  const updateQty = (code: string, delta: number) => {
    setBasket(b => b.map(i => {
      if (i.code !== code) return i;
      const newQty = Math.max(0, i.qty + delta);
      return newQty === 0 ? null : { ...i, qty: newQty };
    }).filter(Boolean) as BasketItem[]);
  };

  const handleSave = async () => {
    if (!pendingLocation || basket.length === 0) return;
    setSaving(true);
    try {
      const codes = basket.flatMap(b => Array(b.qty).fill(b.code));
      const result = await assignProducts(codes, pendingLocation);
      if (result.ok) {
        beep(1000, 80); setTimeout(() => beep(1200, 120), 100);
        toast.success(`Przypisano ${result.totalQuantity} towarów do ${result.location}`, { duration: 3000 });
        setHistory(h => [{ codes: codes.slice(), location: pendingLocation, timestamp: Date.now(), products: result.products || [] }, ...h].slice(0, 5));
        setBasket([]);
      } else {
        beep(200, 400);
        toast.error(result.error || "Błąd");
        if (result.notFound?.length) toast.error(`Nie znaleziono: ${result.notFound.join(", ")}`);
      }
    } catch (e: any) {
      beep(200, 400); toast.error(e.message);
      for (const item of basket) { await addScanToQueue(item.code, pendingLocation); }
      toast.warning("Offline — zapisano w kolejce", { description: `${basket.length} skanów` });
    } finally { setSaving(false); setPendingLocation(null); refocus(); }
  };

  const handleUndo = async (entry: HistoryEntry) => {
    setUndoing(true);
    try {
      const res = await fetch("/api/locations/undo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: entry.location, codes: entry.codes }),
      });
      if (res.ok) { beep(600, 150); toast.success("Cofnięto ostatnią operację"); setHistory(h => h.filter(e => e.timestamp !== entry.timestamp)); }
      else { beep(200, 300); toast.error("Nie udało się cofnąć"); }
    } catch { beep(200, 300); toast.error("Błąd"); }
    finally { setUndoing(false); refocus(); }
  };

  const handleLastLocation = () => {
    if (!lastLocation) return;
    setPendingLocation(lastLocation);
  };

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-lg font-bold">Przypisz towary</h1>

      {/* Last location quick button */}
      {lastLocation && basket.length > 0 && !pendingLocation && (
        <button onClick={handleLastLocation}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-blue-200 bg-blue-50 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 touch-target active:scale-95 transition-all">
          <MapPin className="h-4 w-4" />Przypisz do {lastLocation}
        </button>
      )}

      {/* Input */}
      <div className="relative">
        <input ref={inputRef} value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { setShowSuggestions(false); handleSubmit(); } }}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={mode === "scan" ? "Zeskanuj EAN towaru..." : "Teraz zeskanuj lokalizację"}
          autoComplete="off"
          className={`w-full rounded-lg border-2 bg-background px-4 py-5 text-center text-lg font-mono shadow-inner outline-none transition-colors ${inputBorderClass}`}
        />

        {/* Auto-complete suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border bg-card shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={() => { setInputValue(s.barcode || s.code); setShowSuggestions(false); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent touch-target border-b last:border-0"
              >
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-semibold truncate">{s.barcode || s.code}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="mt-1 text-center text-xs font-medium" style={{ color: mode === "locate" ? "#2563eb" : "#16a34a" }}>
          {mode === "scan" ? "🟢 Skanuj towary (Enter)" : `🔵 Koszyk: ${totalQty} szt. — zeskanuj lokalizację`}
        </p>
      </div>

      {/* Basket */}
      {basket.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
            <span className="text-sm font-semibold">Koszyk ({totalQty} szt.)</span>
            <button onClick={() => setBasket([])} className="touch-target text-xs text-destructive hover:underline"><Trash2 className="mr-1 inline h-3 w-3" />Wyczyść</button>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {basket.map(item => (
              <div key={item.code} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-xs truncate">{item.code}</span>
                    {item.name && <span className="text-xs text-muted-foreground ml-1.5 truncate">{item.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Quantity stepper */}
                  <button onClick={() => updateQty(item.code, -1)} className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-accent font-mono">−</button>
                  <span className="w-5 text-center font-mono text-xs font-semibold">{item.qty}</span>
                  <button onClick={() => updateQty(item.code, 1)} className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-accent font-mono">+</button>
                  <button onClick={() => removeItem(item.code)} className="touch-target rounded p-1 hover:bg-accent ml-1"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation */}
      {pendingLocation && (
        <div className="rounded-lg border-2 border-success bg-success/5 p-4 animate-in slide-in-from-bottom-2">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Potwierdź przypisanie</div>
              <div className="mt-1 font-mono text-lg font-bold">{pendingLocation}</div>
              <div className="text-xs text-muted-foreground mt-1">{totalQty} towarów</div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 flex-1 justify-center">
                  <CheckCircle2 className="h-4 w-4" />{saving ? "Zapisuję…" : "Zapisz"}
                </button>
                <button onClick={() => { setPendingLocation(null); refocus(); }} className="touch-target rounded-md border px-4 py-2.5 text-sm"><X className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History + undo */}
      {history.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground"><History className="h-3.5 w-3.5" />Ostatnie operacje</div>
          <div className="divide-y">
            {history.map(e => (
              <div key={e.timestamp} className="flex items-center justify-between py-1.5 text-xs">
                <div className="min-w-0">
                  <span className="font-mono font-semibold">{e.location}</span>
                  <span className="text-muted-foreground ml-2">{e.codes.length} kodów</span>
                </div>
                <button onClick={() => handleUndo(e)} disabled={undoing}
                  className="touch-target inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-accent text-destructive disabled:opacity-50">
                  <RotateCcw className="h-3 w-3" />Cofnij
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
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
