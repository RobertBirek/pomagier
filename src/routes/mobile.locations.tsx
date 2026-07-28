import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { parseLocation } from "@/lib/locations";
import { addScanToQueue } from "@/lib/offline-queue";
import { LocationPicker } from "@/components/pomagier/LocationPicker";
import { MapPin, Package, X, CheckCircle2, Trash2, History, RotateCcw, ChevronDown, ArrowRightLeft, BarChart3, Lightbulb, AlertTriangle, MoveRight, Layers } from "lucide-react";

interface BasketItem { code: string; name?: string; qty: number; }
interface HistoryEntry { codes: string[]; location: string; timestamp: number; products: { id: number; symbol: string }[]; }
interface DuplicateItem { productId: number; symbol: string; name: string; locations: { code: string; area: string; aisle: number; rack: number; quantity: number }[]; suggestion: string; }

const LAST_LOC_KEY = "pomagier-last-location";

type Mode = "assign" | "transfer" | "reset";

async function assignProducts(codes: string[], location: string) {
  const r = await fetch("/api/locations/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codes, location }) });
  return r.json();
}
async function lookupProduct(code: string) {
  try {
    const r = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (r.ok) { const d = await r.json(); return d.products?.[0]; }
  } catch {}
  return null;
}
function beep(freq: number, duration = 120) {
  try { const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.type = "square"; g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000); o.start(); o.stop(ctx.currentTime + duration / 1000); } catch {}
}

export const Route = createFileRoute("/mobile/locations")({ component: LocationsPage });

const MODES: { key: Mode; label: string; icon: typeof MapPin; color: string }[] = [
  { key: "assign", label: "Przypisz towary", icon: MapPin, color: "bg-blue-500" },
  { key: "transfer", label: "Przenieś towary", icon: ArrowRightLeft, color: "bg-amber-500" },
  { key: "reset", label: "Reset lokalizacji", icon: RotateCcw, color: "bg-red-500" },
];

function LocationsPage() {
  const [mode, setMode] = useState<Mode>("assign");
  const [showModeModal, setShowModeModal] = useState(false);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [lastLocation, setLastLocation] = useState<string | null>(() => localStorage.getItem(LAST_LOC_KEY));
  const [showPicker, setShowPicker] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [stockInfo, setStockInfo] = useState<{ location: string; assigned: number; inSubiekt: number } | null>(null);
  const [hasLocation, setHasLocation] = useState<{ code: string; locations: string[] } | null>(null);
  const [transferSource, setTransferSource] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [resetLocation, setResetLocation] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const refocus = () => setTimeout(() => inputRef.current?.focus(), 50);
  const totalQty = basket.reduce((s, b) => s + b.qty, 0);

  useEffect(() => { refocus(); fetch("/api/locations/duplicates").then(r => r.json()).then(setDuplicates).catch(() => {}); }, []);
  useEffect(() => { const h = () => refocus(); document.addEventListener("click", h); document.addEventListener("touchstart", h); return () => { document.removeEventListener("click", h); document.removeEventListener("touchstart", h); }; }, []);

  const currentMode = MODES.find(m => m.key === mode)!;

  const addToBasket = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    beep(800, 100);
    const loc = parseLocation(trimmed);
    if (loc) {
      if (mode === "reset") { if (!resetLocation) { setResetLocation(loc.raw); toast.success(`Reset na: ${loc.raw}`); } else if (resetLocation === loc.raw && basket.length > 0) { return; } else { toast.error(`Oczekiwano: ${resetLocation}`); beep(200, 300); } setInputValue(""); refocus(); return; }
      if (mode === "transfer") { if (!transferSource) { setTransferSource(loc.raw); toast.success(`Źródło: ${loc.raw}`); } else if (!transferTarget && basket.length > 0) { setTransferTarget(loc.raw); toast.success(`Cel: ${loc.raw}`); } else { toast.error("Najpierw zeskanuj towary"); beep(200, 300); } setInputValue(""); refocus(); return; }
      if (basket.length === 0) { toast.error("Najpierw zeskanuj towary"); beep(200, 300); return; }
      setPendingLocation(loc.raw); setLastLocation(loc.raw); localStorage.setItem(LAST_LOC_KEY, loc.raw); return;
    }
    const existing = basket.find(b => b.code === trimmed);
    if (existing) { setBasket(b => b.map(i => i.code === trimmed ? { ...i, qty: i.qty + 1 } : i)); }
    else { const product = await lookupProduct(trimmed); setBasket(b => [...b, { code: trimmed, name: product?.name, qty: 1 }]); }
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
      if (result.ok) { beep(1000, 80); setTimeout(() => beep(1200, 120), 100); toast.success(`Przypisano ${result.totalQuantity} do ${result.location}`, { duration: 3000 }); setHistory(h => [{ codes: codes.slice(), location: pendingLocation, timestamp: Date.now(), products: result.products || [] }, ...h].slice(0, 5)); try { const sr = await fetch(`/api/locations/verify?location=${encodeURIComponent(pendingLocation)}`); const st = await sr.json(); if (st.comparison) setStockInfo(st.comparison); } catch {} setBasket([]); }
      else { beep(200, 400); toast.error(result.error || "Błąd"); if (result.notFound?.length) toast.error(`Nie znaleziono: ${result.notFound.join(", ")}`); }
    } catch (e: any) { beep(200, 400); toast.error(e.message); for (const item of basket) { await addScanToQueue(item.code, pendingLocation); } toast.warning("Offline — zapisano w kolejce"); }
    finally { setSaving(false); setPendingLocation(null); refocus(); }
  };

  const handleTransfer = async () => { if (!transferSource || !transferTarget || basket.length === 0) return; setTransferring(true); try { const codes = basket.flatMap(b => Array(b.qty).fill(b.code)); const r = await fetch("/api/locations/transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codes, fromLocation: transferSource, toLocation: transferTarget }) }); if (r.ok) { const d = await r.json(); beep(1000, 80); toast.success(`Przeniesiono ${d.moved} ${transferSource} → ${transferTarget}`); setBasket([]); setTransferSource(null); setTransferTarget(null); } else { beep(200, 400); toast.error((await r.json()).error); } } catch (e: any) { beep(200, 400); toast.error(e.message); } finally { setTransferring(false); refocus(); } };

  const handleReset = async () => { if (!resetLocation || basket.length === 0) return; setResetting(true); try { const codes = basket.flatMap(b => Array(b.qty).fill(b.code)); const r = await fetch("/api/locations/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codes, location: resetLocation }) }); if (r.ok) { const d = await r.json(); toast.success(`Reset: ${d.reset} → ${resetLocation}`); setBasket([]); setResetLocation(null); } else toast.error((await r.json()).error); } catch (e: any) { toast.error(e.message); } finally { setResetting(false); refocus(); } };

  const handleUndo = async (entry: HistoryEntry) => { setUndoing(true); try { const r = await fetch("/api/locations/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: entry.location, codes: entry.codes }) }); if (r.ok) { beep(600, 150); toast.success("Cofnięto"); setHistory(h => h.filter(e => e.timestamp !== entry.timestamp)); } else { beep(200, 300); toast.error("Nie udało się cofnąć"); } } catch { beep(200, 300); toast.error("Błąd"); } finally { setUndoing(false); refocus(); } };

  const handleLocationPick = (code: string) => { setPendingLocation(code); setLastLocation(code); localStorage.setItem(LAST_LOC_KEY, code); setShowPicker(false); };
  const handleLastLocation = () => { if (!lastLocation) return; setPendingLocation(lastLocation); };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky header with input + mode button */}
      <div className="sticky top-0 z-30 bg-card border-b safe-top px-3 py-2 space-y-2">
        <div className="flex items-center gap-2">
          {/* Scan input */}
          <input ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }} placeholder="Skanuj EAN lub lokalizację..." autoComplete="off" className="flex-1 rounded-lg border-2 border-primary/40 bg-background px-4 py-3 text-base font-mono font-bold shadow-inner outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors" />
          {/* Basket badge */}
          {totalQty > 0 && <span className="shrink-0 grid place-items-center rounded-full bg-primary w-7 h-7 text-xs font-bold text-primary-foreground">{totalQty}</span>}
          {/* Mode button */}
          <button onClick={() => setShowModeModal(true)} className={`shrink-0 grid place-items-center rounded-lg w-12 h-12 ${currentMode.color} text-white shadow active:scale-95 transition-transform`}>
            <currentMode.icon className="h-6 w-6" />
          </button>
        </div>
        {/* Mode status */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{currentMode.label}</span>
          {mode === "transfer" && transferSource && <span className="font-mono text-green-600">{transferSource} → {transferTarget || "?"}</span>}
          {mode === "reset" && resetLocation && <span className="font-mono text-red-600">{resetLocation}</span>}
        </div>
      </div>

      {/* Mode selection modal */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModeModal(false)}>
          <div className="w-64 rounded-xl bg-card p-4 shadow-xl space-y-2" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-bold mb-2">Tryb działania</div>
            {MODES.map(m => (
              <button key={m.key} onClick={() => { setMode(m.key); setShowModeModal(false); setBasket([]); setPendingLocation(null); setTransferSource(null); setTransferTarget(null); setResetLocation(null); }} className={`w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold transition-colors ${mode === m.key ? `${m.color} text-white` : "hover:bg-accent"}`}>
                <m.icon className="h-5 w-5" />{m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-3 space-y-3">
        {/* Last location quick button */}
        {lastLocation && basket.length > 0 && !pendingLocation && mode === "assign" && (
          <button onClick={handleLastLocation} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-blue-200 bg-blue-50 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 touch-target active:scale-95 transition-all">
            <MapPin className="h-4 w-4" />Przypisz do {lastLocation}
          </button>
        )}

        {/* Transfer status */}
        {mode === "transfer" && (
          <div className="flex gap-2 text-xs">
            <div className={`flex-1 rounded-lg border px-3 py-2 ${transferSource ? "border-green-300 bg-green-50" : "border-dashed"}`}><div className="text-muted-foreground">Źródło</div><div className="font-mono font-bold">{transferSource || "—"}</div></div>
            <div className="flex items-center">→</div>
            <div className={`flex-1 rounded-lg border px-3 py-2 ${transferTarget ? "border-blue-300 bg-blue-50" : "border-dashed"}`}><div className="text-muted-foreground">Cel</div><div className="font-mono font-bold">{transferTarget || "—"}</div></div>
          </div>
        )}

        {/* Reset status */}
        {mode === "reset" && resetLocation && <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm font-mono font-bold text-red-700 text-center">Reset do: {resetLocation}</div>}

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

        {/* Confirmation: assign */}
        {pendingLocation && mode === "assign" && (
          <div className="rounded-lg border-2 border-success bg-success/5 p-4">
            <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-success shrink-0" /><div className="flex-1"><div className="font-semibold text-sm">Potwierdź przypisanie</div><div className="mt-1 font-mono text-lg font-bold">{pendingLocation}</div><div className="text-xs text-muted-foreground mt-1">{totalQty} towarów</div><div className="mt-3 flex gap-2"><button onClick={handleSave} disabled={saving} className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground flex-1 justify-center"><CheckCircle2 className="h-4 w-4" />{saving ? "Zapisuję…" : "Zapisz"}</button><button onClick={() => { setPendingLocation(null); refocus(); }} className="touch-target rounded-md border px-4 py-2.5 text-sm"><X className="h-4 w-4" /></button></div></div></div>
          </div>
        )}

        {/* Confirmation: transfer */}
        {mode === "transfer" && transferSource && transferTarget && basket.length > 0 && (
          <div className="rounded-lg border-2 border-success bg-success/5 p-4"><div className="flex items-start gap-3"><ArrowRightLeft className="mt-0.5 h-5 w-5 text-success shrink-0" /><div className="flex-1"><div className="font-semibold text-sm">Potwierdź przeniesienie</div><div className="mt-1 font-mono text-sm">{transferSource} → <span className="font-bold">{transferTarget}</span></div><div className="text-xs text-muted-foreground mt-1">{totalQty} towarów</div><div className="mt-3 flex gap-2"><button onClick={handleTransfer} disabled={transferring} className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground flex-1 justify-center"><CheckCircle2 className="h-4 w-4" />{transferring ? "Przenoszę…" : "Wykonaj"}</button><button onClick={() => { setTransferSource(null); setTransferTarget(null); refocus(); }} className="touch-target rounded-md border px-4 py-2.5 text-sm"><X className="h-4 w-4" /></button></div></div></div>
          </div>
        )}

        {/* Confirmation: reset */}
        {mode === "reset" && resetLocation && basket.length > 0 && (
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4"><div className="flex items-start gap-3"><RotateCcw className="mt-0.5 h-5 w-5 text-red-600 shrink-0" /><div className="flex-1"><div className="font-semibold text-sm text-red-800">Potwierdź reset</div><div className="mt-1 font-mono text-lg font-bold">{resetLocation}</div><div className="text-xs text-muted-foreground mt-1">⚠️ Usuwa wszystkie inne lokalizacje dla {totalQty} towarów</div><div className="mt-3 flex gap-2"><button onClick={handleReset} disabled={resetting} className="touch-target inline-flex items-center gap-1.5 rounded-md bg-red-600 px-6 py-2.5 text-sm font-medium text-white flex-1 justify-center">{resetting ? "Resetuję…" : "Resetuj"}</button><button onClick={() => { setResetLocation(null); refocus(); }} className="touch-target rounded-md border px-4 py-2.5 text-sm"><X className="h-4 w-4" /></button></div></div></div>
          </div>
        )}

        {/* Stock verification */}
        {stockInfo && basket.length === 0 && (
          <div className="rounded-lg border bg-card p-3"><div className="flex items-center gap-2 text-sm font-semibold mb-2"><BarChart3 className="h-4 w-4 text-primary" />Weryfikacja — {stockInfo.location}</div><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded bg-muted/50 p-2"><div className="text-muted-foreground">Przypisane</div><div className="font-bold text-lg">{stockInfo.assigned}</div></div><div className="rounded bg-muted/50 p-2"><div className="text-muted-foreground">W Subiekt GT</div><div className="font-bold text-lg">{stockInfo.inSubiekt}</div></div></div><div className={`mt-2 text-xs font-medium ${stockInfo.assigned === stockInfo.inSubiekt ? "text-success" : "text-warning"}`}>{stockInfo.assigned === stockInfo.inSubiekt ? "✅ Stan zgodny" : `⚠️ Różnica: ${Math.abs(stockInfo.assigned - stockInfo.inSubiekt)} szt.`}</div></div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="rounded-lg border bg-card p-3"><div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground"><History className="h-3.5 w-3.5" />Ostatnie operacje</div><div className="divide-y">{history.map(e => (<div key={e.timestamp} className="flex items-center justify-between py-1.5 text-xs"><div className="min-w-0"><span className="font-mono font-semibold">{e.location}</span><span className="text-muted-foreground ml-2">{e.codes.length} kodów</span></div><button onClick={() => handleUndo(e)} disabled={undoing} className="touch-target inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-accent text-destructive"><RotateCcw className="h-3 w-3" />Cofnij</button></div>))}</div></div>
        )}

        {/* Empty */}
        {basket.length === 0 && !pendingLocation && !stockInfo && (
          <div className="text-center py-12 text-muted-foreground"><Package className="mx-auto h-12 w-12 opacity-20 mb-2" /><p className="text-sm">Zeskanuj EAN lub kod lokalizacji</p></div>
        )}
      </div>
    </div>
  );
}
