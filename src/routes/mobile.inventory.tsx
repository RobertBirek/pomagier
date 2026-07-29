import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ScanHeader } from "@/components/pomagier/ScanHeader";
import { parseLocation } from "@/lib/locations";
import { useBasket } from "@/hooks/use-basket";
import { beep, cn } from "@/lib/utils";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { StatusBadge, SectionTitle } from "@/components/pomagier/primitives";
import { BasketPanel } from "@/components/pomagier/BasketPanel";

interface ExpectedProduct {
  id: number;
  symbol: string;
  name: string;
  barcode: string;
  unit: string;
  qty: number;
  subiektStock: number;
  locations: string[];
  scannedQty: number;
}

interface InventoryResult {
  summary: {
    expected: number;
    scanned: number;
    matched: number;
    missing: number;
    extra: number;
    quantityDiff: number;
  };
  matched: ExpectedProduct[];
  missing: ExpectedProduct[];
  extra: { code: string; qty: number; name?: string }[];
  quantityDiff: (ExpectedProduct & { scannedQty: number })[];
}

async function fetchExpected(
  loc: { area: string; aisle?: number; rack?: number; shelf?: number },
  scope: string,
) {
  const params = new URLSearchParams({ scope, area: loc.area });
  if (loc.aisle != null) params.set("aisle", String(loc.aisle));
  if (loc.rack != null) params.set("rack", String(loc.rack));
  if (loc.shelf != null) params.set("shelf", String(loc.shelf));
  const r = await fetch(`/api/inventory/expected?${params.toString()}`);
  return r.json() as Promise<{ products: ExpectedProduct[] }>;
}

async function submitReport(
  scope: string,
  loc: { area: string; aisle?: number; rack?: number; shelf?: number },
  codes: string[],
) {
  const r = await fetch("/api/inventory/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope,
      area: loc.area,
      aisle: loc.aisle ?? 0,
      rack: loc.rack ?? 0,
      shelf: loc.shelf ?? 0,
      scanned: codes.map((c) => ({ code: c, qty: 1 })),
    }),
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<InventoryResult>;
}

export const Route = createFileRoute("/mobile/inventory")({ component: InventoryPage });

const SCOPES = [
  { key: "exact", label: "Pojedyncza lokalizacja", desc: "np. A 1-2-3-1" },
  { key: "shelf", label: "Cała półka", desc: "np. A 1-2 — wszystkie shelf" },
  { key: "rack", label: "Cały regał", desc: "np. A 1 — wszystkie rack i shelf" },
  { key: "area", label: "Cały obszar", desc: "np. A — wszystkie" },
] as const;

function InventoryPage() {
  const { basket, totalQty, flatCodes, addToBasket, removeItem, updateQty, clearBasket } =
    useBasket();

  const [step, setStep] = useState<"setup" | "scan" | "report">("setup");
  const [scope, setScope] = useState("exact");
  const [location, setLocation] = useState("");
  const [expected, setExpected] = useState<ExpectedProduct[]>([]);
  const [report, setReport] = useState<InventoryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const expectedByBarcode = useMemo(() => {
    const map = new Map<string, ExpectedProduct>();
    for (const p of expected) {
      if (p.barcode) map.set(p.barcode, p);
      map.set(p.symbol, p);
    }
    return map;
  }, [expected]);

  const scannedMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const code of flatCodes) {
      const ep = expectedByBarcode.get(code);
      if (ep) map.set(ep.id, (map.get(ep.id) || 0) + 1);
    }
    return map;
  }, [flatCodes, expectedByBarcode]);

  const productsWithProgress = useMemo(
    () =>
      expected.map((p) => ({
        ...p,
        scannedQty: scannedMap.get(p.id) || 0,
        done: (scannedMap.get(p.id) || 0) >= p.qty,
      })),
    [expected, scannedMap],
  );
  const matchedCount = productsWithProgress.filter((p) => p.done).length;
  const progress = expected.length > 0 ? Math.round((matchedCount / expected.length) * 100) : 0;

  const startScan = async () => {
    if (!location.trim()) return;
    setLoading(true);
    try {
      const loc = parseLocation(location.trim());
      if (!loc) {
        toast.error("Nieprawidłowy format lokalizacji");
        setLoading(false);
        return;
      }
      const data = await fetchExpected(loc, scope);
      if (data.products.length === 0) {
        toast.error("Brak produktów w tym zakresie");
        setLoading(false);
        return;
      }
      setExpected(data.products);
      setStep("scan");
      beep(800, 100);
      clearBasket();
    } catch {
      toast.error("Błąd pobierania danych");
    }
    setLoading(false);
  };

  // ── Submit handler for ScanHeader ──
  const handleSubmit = useCallback(
    async (code: string): Promise<boolean> => {
      const ep = expectedByBarcode.get(code);
      if (ep) {
        beep(800, 100);
        setTimeout(() => beep(1000, 80), 120);
        await addToBasket(code);
        toast.success(ep.name || ep.symbol, {
          duration: 800,
          description: `${(scannedMap.get(ep.id) || 0) + 1}/${ep.qty}`,
        });
        return true;
      } else {
        await addToBasket(code);
        toast.warning("Nieoczekiwany produkt", { duration: 1200, description: code });
        return false;
      }
    },
    [expectedByBarcode, addToBasket, scannedMap],
  );

  const finishScan = async () => {
    if (basket.length === 0) return;
    setLoading(true);
    try {
      const loc = parseLocation(location.trim())!;
      const result = await submitReport(scope, loc, flatCodes);
      setReport(result);
      setStep("report");
      beep(1000, 80);
      setTimeout(() => beep(1200, 120), 120);
    } catch (e: unknown) {
      beep(200, 400);
      toast.error(e instanceof Error ? e.message : "Błąd");
    }
    setLoading(false);
  };

  const resetAll = () => {
    setStep("setup");
    clearBasket();
    setReport(null);
    setExpected([]);
    setLocation("");
  };

  // ── Scan phase with ScanHeader ──
  if (step === "scan") {
    return (
      <div className="flex flex-col min-h-screen">
        <ScanHeader
          onSubmit={handleSubmit}
          hint={`🟢 Zeskanowano ${totalQty} szt. — Enter aby dodać`}
        />

        <div className="flex-1 p-4 space-y-4">
          {/* Progress bar */}
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" />
                {matchedCount}/{expected.length}
              </span>
              <StatusBadge tone={progress === 100 ? "success" : "info"}>{progress}%</StatusBadge>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Products list */}
          <div className="rounded-lg border bg-card divide-y max-h-64 overflow-y-auto">
            {productsWithProgress.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-xs transition-colors",
                  p.done && "bg-green-50",
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors",
                    p.done ? "bg-green-500 border-green-500" : "border-muted-foreground/30",
                  )}
                >
                  {p.done && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-semibold truncate">{p.symbol}</div>
                  <div className="text-muted-foreground truncate">{p.name}</div>
                  {p.locations.length > 0 && (
                    <div className="flex items-center gap-1 mt-0.5 text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5" />
                      {p.locations.slice(0, 2).join(", ")}
                      {p.locations.length > 2 && ` +${p.locations.length - 2}`}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={cn("font-bold", p.done ? "text-green-700" : "text-muted-foreground")}
                  >
                    {p.scannedQty}/{p.qty}
                  </div>
                  {p.subiektStock > 0 && (
                    <div className="text-[10px] text-muted-foreground">stan: {p.subiektStock}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Basket */}
          <BasketPanel
            items={basket}
            totalQty={totalQty}
            onUpdateQty={updateQty}
            onRemove={removeItem}
            onClear={clearBasket}
          />

          {/* Finish */}
          <button
            onClick={finishScan}
            disabled={basket.length === 0 || loading}
            className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50 touch-target inline-flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading ? "Przetwarzanie…" : `Zakończ inwentaryzację (${totalQty} szt.)`}
          </button>

          {/* Back */}
          <button
            onClick={resetAll}
            className="w-full touch-target text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Nowa inwentaryzacja
          </button>
        </div>
      </div>
    );
  }

  // ── Setup phase ──
  if (step === "setup") {
    return (
      <div className="mx-auto max-w-md p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Inwentaryzacja</h1>
        </div>
        <p className="text-xs text-muted-foreground">Wybierz zakres inwentaryzacji:</p>
        <div className="space-y-2">
          {SCOPES.map((s) => (
            <label
              key={s.key}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer touch-target ${scope === s.key ? "border-primary bg-primary/5" : "hover:bg-muted/30"}`}
            >
              <input
                type="radio"
                name="scope"
                checked={scope === s.key}
                onChange={() => setScope(s.key)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-semibold">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
            </label>
          ))}
        </div>
        <div>
          <label className="text-xs font-medium">Lokalizacja bazowa</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") startScan();
            }}
            placeholder="np. A 1-2-3-1"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border-2 border-primary/40 bg-background px-4 py-4 text-center text-lg font-mono shadow-inner outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={startScan}
          disabled={!location.trim() || loading}
          className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50 touch-target"
        >
          {loading ? "⏳ Ładowanie…" : "Rozpocznij inwentaryzację"}
        </button>
      </div>
    );
  }

  // ── Report phase ──
  if (step === "report" && report) {
    return (
      <div className="mx-auto max-w-md p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Raport
          </h2>
          <button
            onClick={resetAll}
            className="touch-target inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Nowa
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-2xl font-bold text-green-700">{report.summary.matched}</div>
            <div className="text-xs text-green-600">Zgodne</div>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <div className="text-2xl font-bold text-red-700">{report.summary.missing}</div>
            <div className="text-xs text-red-600">Brak</div>
          </div>
          <div className="rounded-lg bg-orange-50 p-3 text-center">
            <div className="text-2xl font-bold text-orange-700">{report.summary.extra}</div>
            <div className="text-xs text-orange-600">Nadwyżka</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{report.summary.quantityDiff}</div>
            <div className="text-xs text-amber-600">Ilość różna</div>
          </div>
        </div>
        {report.missing.length > 0 && (
          <div>
            <SectionTitle title={`Brakujące (${report.missing.length})`} />
            {report.missing.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs py-1 border-b">
                <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                <span className="font-mono">{p.symbol}</span>
                <span className="text-muted-foreground truncate">{p.name}</span>
                <span className="ml-auto">×{p.qty}</span>
              </div>
            ))}
          </div>
        )}
        {report.extra.length > 0 && (
          <div>
            <SectionTitle title={`Nadwyżki (${report.extra.length})`} />
            {report.extra.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 border-b">
                <TrendingUp className="h-3 w-3 text-orange-500 shrink-0" />
                <span className="font-mono">{e.code}</span>
                {e.name && <span className="text-muted-foreground">{e.name}</span>}
                <span className="ml-auto">×{e.qty}</span>
              </div>
            ))}
          </div>
        )}
        {report.quantityDiff.length > 0 && (
          <div>
            <SectionTitle title={`Różnice ilości (${report.quantityDiff.length})`} />
            {report.quantityDiff.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs py-1 border-b">
                <TrendingDown className="h-3 w-3 text-amber-500 shrink-0" />
                <span className="font-mono">{d.symbol}</span>
                <span className="text-muted-foreground">
                  oczek. {d.qty}, jest {d.scannedQty}
                </span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={resetAll}
          className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground touch-target"
        >
          Nowa inwentaryzacja
        </button>
      </div>
    );
  }

  return null;
}
