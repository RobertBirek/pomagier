import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { MapPin, Package, CheckCircle2, X, AlertTriangle, BarChart3, TrendingUp, TrendingDown, Search, Layers } from "lucide-react";
import { StatusBadge, SectionTitle } from "@/components/pomagier/primitives";

async function fetchExpected(location: string, scope: string) {
  const parts = location.split(" "); const area = parts[0]; const nums = (parts[1] || "1-1-1-1").split("-");
  const aisle = nums[0] || "0"; const rack = nums[1] || "0"; const shelf = nums[2] || "0";
  const r = await fetch(`/api/inventory/expected?scope=${scope}&area=${area}&aisle=${aisle}&rack=${rack}&shelf=${shelf}`);
  return r.json() as Promise<{ scope: string; area: string; aisle: number; rack: number; shelf: number; products: any[] }>;
}

async function submitReport(data: any) {
  const r = await fetch("/api/inventory/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export const Route = createFileRoute("/mobile/inventory")({ component: InventoryPage });

function InventoryPage() {
  const [step, setStep] = useState<"setup" | "scan" | "report">("setup");
  const [scope, setScope] = useState("exact");
  const [location, setLocation] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [expected, setExpected] = useState<any>(null);
  const [basket, setBasket] = useState<{ code: string; qty: number }[]>([]);
  const [report, setReport] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refocus = () => setTimeout(() => inputRef.current?.focus(), 50);

  useEffect(() => { refocus(); }, []);

  const scopes = [
    { key: "exact", label: "Pojedyncza lokalizacja", desc: "np. A 1-2-3-1" },
    { key: "shelf", label: "Cała półka", desc: "np. A 1-2 — wszystkie shelf" },
    { key: "rack", label: "Cały regał", desc: "np. A 1 — wszystkie rack i shelf" },
    { key: "area", label: "Cały obszar", desc: "np. A — wszystkie" },
  ];

  const startScan = async () => {
    if (!location.trim()) return;
    try {
      const data = await fetchExpected(location.trim(), scope);
      if (data.products.length === 0) { toast.error("Brak produktów w tym zakresie"); return; }
      setExpected(data);
      setStep("scan");
      toast.success(`Znaleziono ${data.products.length} produktów`);
      refocus();
    } catch { toast.error("Błąd pobierania"); }
  };

  const addToBasket = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBasket(b => { const existing = b.find(i => i.code === trimmed); if (existing) return b.map(i => i.code === trimmed ? { ...i, qty: i.qty + 1 } : i); return [...b, { code: trimmed, qty: 1 }]; });
    setInputValue(""); refocus();
  };

  const finishScan = async () => {
    if (!expected) return;
    try {
      const parts = location.split(" "); const area = parts[0]; const nums = (parts[1] || "1-1-1-1").split("-");
      const result = await submitReport({
        scope, area, aisle: parseInt(nums[0] || "0"), rack: parseInt(nums[1] || "0"), shelf: parseInt(nums[2] || "0"),
        scanned: basket.map(b => ({ code: b.code, qty: b.qty })),
      });
      setReport(result);
      setStep("report");
    } catch (e: any) { toast.error(e.message); }
  };

  const totalBasket = basket.reduce((s, b) => s + b.qty, 0);

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-lg font-bold">Inwentaryzacja</h1>

      {step === "setup" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Wybierz zakres inwentaryzacji:</p>
            <div className="space-y-2">
              {scopes.map(s => (
                <label key={s.key} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${scope === s.key ? "border-primary bg-primary/5" : "hover:bg-muted/30"}`}>
                  <input type="radio" name="scope" checked={scope === s.key} onChange={() => setScope(s.key)} className="mt-0.5" />
                  <div><div className="text-sm font-semibold">{s.label}</div><div className="text-xs text-muted-foreground">{s.desc}</div></div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Lokalizacja bazowa</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="np. A 1-2-3-1" className="mt-1 w-full rounded-lg border-2 border-primary/40 bg-background px-4 py-4 text-center text-lg font-mono shadow-inner outline-none focus:border-primary" />
          </div>
          <button onClick={startScan} disabled={!location.trim()} className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">Rozpocznij inwentaryzację</button>
        </div>
      )}

      {step === "scan" && expected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold"><Layers className="inline h-4 w-4 mr-1" />{expected.products.length} produktów oczekiwanych</span>
            <StatusBadge tone="info">{scope}</StatusBadge>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 max-h-40 overflow-y-auto text-xs space-y-1">
            {expected.products.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-0.5 border-b last:border-0">
                <div className="font-mono truncate">{p.symbol}</div>
                <div className="text-muted-foreground">×{p.qty}</div>
              </div>
            ))}
          </div>

          <input ref={inputRef} value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addToBasket(inputValue); }} placeholder="Skanuj EAN towaru..." autoComplete="off" className="w-full rounded-lg border-2 border-primary/40 bg-background px-4 py-5 text-center text-lg font-mono shadow-inner outline-none focus:border-primary" />

          {basket.length > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <div className="text-sm font-semibold mb-2">Zeskanowano: {totalBasket} szt.</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {basket.map(b => (
                  <div key={b.code} className="flex items-center justify-between text-xs"><span className="font-mono">{b.code}</span><div className="flex items-center gap-2"><span>×{b.qty}</span><button onClick={() => setBasket(prev => prev.filter(i => i.code !== b.code))} className="text-destructive"><X className="h-3 w-3" /></button></div></div>
                ))}
              </div>
            </div>
          )}

          <button onClick={finishScan} disabled={basket.length === 0} className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">Zakończ inwentaryzację</button>
        </div>
      )}

      {step === "report" && report && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Raport</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 p-3 text-center"><div className="text-2xl font-bold text-green-700">{report.summary.matched}</div><div className="text-xs text-green-600">Zgodne</div></div>
            <div className="rounded-lg bg-red-50 p-3 text-center"><div className="text-2xl font-bold text-red-700">{report.summary.missing}</div><div className="text-xs text-red-600">Brak</div></div>
            <div className="rounded-lg bg-orange-50 p-3 text-center"><div className="text-2xl font-bold text-orange-700">{report.summary.extra}</div><div className="text-xs text-orange-600">Nadwyżka</div></div>
            <div className="rounded-lg bg-amber-50 p-3 text-center"><div className="text-2xl font-bold text-amber-700">{report.summary.quantityDiff}</div><div className="text-xs text-amber-600">Ilość różna</div></div>
          </div>

          {report.missing.length > 0 && (
            <div>
              <SectionTitle title={`Brakujące (${report.missing.length})`} />
              {report.missing.map((p: any) => <div key={p.id} className="flex items-center gap-2 text-xs py-1 border-b"><AlertTriangle className="h-3 w-3 text-red-500" /><span className="font-mono">{p.symbol}</span><span className="text-muted-foreground">{p.name}</span><span className="ml-auto">×{p.qty}</span></div>)}
            </div>
          )}

          {report.extra.length > 0 && (
            <div>
              <SectionTitle title={`Nadwyżki (${report.extra.length})`} />
              {report.extra.map((e: any, i: number) => <div key={i} className="flex items-center gap-2 text-xs py-1 border-b"><TrendingUp className="h-3 w-3 text-orange-500" /><span className="font-mono">{e.code}</span><span className="ml-auto">×{e.qty}</span></div>)}
            </div>
          )}

          {report.quantityDiff.length > 0 && (
            <div>
              <SectionTitle title={`Różnice ilości (${report.quantityDiff.length})`} />
              {report.quantityDiff.map((d: any) => <div key={d.id} className="flex items-center gap-2 text-xs py-1 border-b"><TrendingDown className="h-3 w-3 text-amber-500" /><span className="font-mono">{d.symbol}</span><span className="text-muted-foreground">oczek. {d.expectedQty}, jest {d.scannedQty}</span></div>)}
            </div>
          )}

          <button onClick={() => { setStep("setup"); setBasket([]); setReport(null); setExpected(null); setLocation(""); }} className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground">Nowa inwentaryzacja</button>
        </div>
      )}
    </div>
  );
}
