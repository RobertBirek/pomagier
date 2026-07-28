import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { parseLocation } from "@/lib/locations";
import { addScanToQueue } from "@/lib/offline-queue";
import { MapPin, Package, X, CheckCircle2, Trash2, History, RotateCcw, ArrowRightLeft, BarChart3 } from "lucide-react";

interface BasketItem { code: string; name?: string; qty: number; }
interface HistoryEntry { codes: string[]; location: string; timestamp: number; products: { id: number; symbol: string }[]; }

const LAST_LOC_KEY = "pomagier-last-location";

async function assignProducts(codes: string[], location: string) {
  const r = await fetch("/api/locations/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codes, location }) });
  return r.json();
}

function beep(freq: number, duration = 120) {
  try { const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.type = "square"; g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000); o.start(); o.stop(ctx.currentTime + duration / 1000); } catch {}
}

export const Route = createFileRoute("/mobile/locations")({ component: LocationsPage });

function LocationsPage() {
  // Global state is managed by the header in mobile.tsx Layout
  // This page just renders the basket, confirmations, history below the sticky header
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [stockInfo, setStockInfo] = useState<{ location: string; assigned: number; inSubiekt: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refocus = () => setTimeout(() => inputRef.current?.focus(), 50);
  const totalQty = basket.reduce((s, b) => s + b.qty, 0);

  useEffect(() => { refocus(); }, []);
  useEffect(() => { const h = () => refocus(); document.addEventListener("click", h); document.addEventListener("touchstart", h); return () => { document.removeEventListener("click", h); document.removeEventListener("touchstart", h); }; }, []);

  const addToBasket = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    beep(800, 100);
    const loc = parseLocation(trimmed);
    if (loc) {
      if (basket.length === 0) { toast.error("Najpierw zeskanuj towary"); return; }
      setPendingLocation(loc.raw); localStorage.setItem(LAST_LOC_KEY, loc.raw);
      return;
    }
    const existing = basket.find(b => b.code === trimmed);
    if (existing) { setBasket(b => b.map(i => i.code === trimmed ? { ...i, qty: i.qty + 1 } : i)); }
    else { setBasket(b => [...b, { code: trimmed, qty: 1 }]); }
    toast.success(`Dodano: ${trimmed}`, { duration: 800 });
    setInputValue(""); refocus();
  };
  const handleSubmit = () => addToBasket(inputValue);
  const removeItem = (code: string) => { setBasket(b => b.filter(i => i.code !== code)); refocus(); };
  const updateQty = (code: string, delta: number) => { setBasket(b => b.map(i => { if (i.code !== code) return i; const q = Math.max(0, i.qty + delta); return q === 0 ? null : { ...i, qty: q }; }).filter(Boolean) as BasketItem[]); };

  const handleSave = async () => {
    if (!pendingLocation || basket.length === 0) return; setSaving(true);
    try {
      const codes = basket.flatMap(b => Array(b.qty).fill(b.code));
      const result = await assignProducts(codes, pendingLocation);
      if (result.ok) { beep(1000, 80); setTimeout(() => beep(1200, 120), 100); toast.success(`Przypisano ${result.totalQuantity} do ${result.location}`, { duration: 3000 }); setHistory(h => [{ codes: codes.slice(), location: pendingLocation, timestamp: Date.now(), products: result.products || [] }, ...h].slice(0, 5)); setBasket([]); }
      else { beep(200, 400); toast.error(result.error || "Błąd"); }
    } catch (e: any) { beep(200, 400); toast.error(e.message); for (const item of basket) { await addScanToQueue(item.code, pendingLocation); } toast.warning("Offline — zapisano w kolejce"); }
    finally { setSaving(false); setPendingLocation(null); refocus(); }
  };

  const handleUndo = async (entry: HistoryEntry) => { setUndoing(true); try { const r = await fetch("/api/locations/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: entry.location, codes: entry.codes }) }); if (r.ok) { beep(600, 150); toast.success("Cofnięto"); setHistory(h => h.filter(e => e.timestamp !== entry.timestamp)); } else { beep(200, 300); toast.error("Nie udało się cofnąć"); } } catch { beep(200, 300); toast.error("Błąd"); } finally { setUndoing(false); refocus(); } };

  return (
    <div className="p-3 space-y-3">
      {/* Basket */}
      {basket.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 text-sm font-semibold">Koszyk ({totalQty} szt.)</div>
          <div className="divide-y max-h-48 overflow-y-auto">
            {basket.map(item => (
              <div key={item.code} className="flex items-center justify-between px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0"><span className="font-mono text-xs truncate">{item.code}</span>{item.name && <span className="text-xs text-muted-foreground ml-1.5 truncate">{item.name}</span>}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(item.code, -1)} className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-accent font-mono">−</button>
                  <span className="w-5 text-center font-mono text-xs font-semibold">{item.qty}</span>
                  <button onClick={() => updateQty(item.code, 1)} className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-accent font-mono">+</button>
                  <button onClick={() => removeItem(item.code)} className="touch-target rounded p-1 hover:bg-accent ml-1"><X className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation */}
      {pendingLocation && (
        <div className="rounded-lg border-2 border-success bg-success/5 p-4">
          <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-success shrink-0" /><div className="flex-1"><div className="font-semibold text-sm">Potwierdź przypisanie</div><div className="mt-1 font-mono text-lg font-bold">{pendingLocation}</div><div className="text-xs text-muted-foreground mt-1">{totalQty} towarów</div><div className="mt-3 flex gap-2"><button onClick={handleSave} disabled={saving} className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground flex-1 justify-center"><CheckCircle2 className="h-4 w-4" />{saving ? "Zapisuję…" : "Zapisz"}</button><button onClick={() => { setPendingLocation(null); refocus(); }} className="touch-target rounded-md border px-4 py-2.5 text-sm"><X className="h-4 w-4" /></button></div></div></div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-lg border bg-card p-3"><div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground"><History className="h-3.5 w-3.5" />Ostatnie operacje</div><div className="divide-y">{history.map(e => (<div key={e.timestamp} className="flex items-center justify-between py-1.5 text-xs"><div className="min-w-0"><span className="font-mono font-semibold">{e.location}</span><span className="text-muted-foreground ml-2">{e.codes.length} kodów</span></div><button onClick={() => handleUndo(e)} disabled={undoing} className="touch-target inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-accent text-destructive"><RotateCcw className="h-3 w-3" />Cofnij</button></div>))}</div></div>
      )}
      {/* Empty */}
      {basket.length === 0 && !pendingLocation && history.length === 0 && (
        <div className="text-center py-16 text-muted-foreground"><Package className="mx-auto h-12 w-12 opacity-20 mb-2" /><p className="text-sm">Skanuj EAN towaru w polu powyżej</p><p className="text-xs mt-1">Następnie zeskanuj kod lokalizacji</p></div>
      )}
    </div>
  );
}
