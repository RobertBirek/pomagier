import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ScanHeader, type ScanHeaderTool } from "@/components/pomagier/ScanHeader";
import { parseLocation } from "@/lib/locations";
import { addScanToQueue } from "@/lib/offline-queue";
import { useAuth } from "@/lib/auth";
import { beep } from "@/lib/utils";
import {
  MapPin,
  Package,
  X,
  CheckCircle2,
  Trash2,
  History,
  RotateCcw,
  ArrowRightLeft,
  BarChart3,
} from "lucide-react";

interface BasketItem {
  code: string;
  name?: string;
  qty: number;
}
interface HistoryEntry {
  codes: string[];
  location: string;
  timestamp: number;
  products: { id: number; symbol: string }[];
}

const LAST_LOC_KEY = "pomagier-last-location";

type Mode = "assign" | "transfer" | "reset";

async function assignProducts(codes: string[], location: string) {
  const r = await fetch("/api/locations/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codes, location }),
  });
  return r.json();
}

async function lookupProduct(code: string) {
  try {
    const r = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (r.ok) {
      const d = await r.json();
      return d.products?.[0];
    }
  } catch {
    /* offline */
  }
  return null;
}

const MODES: { key: Mode; label: string; icon: typeof MapPin; color: string }[] = [
  { key: "assign", label: "Przypisz towary", icon: MapPin, color: "bg-blue-500" },
  { key: "transfer", label: "Przenieś towary", icon: ArrowRightLeft, color: "bg-amber-500" },
  { key: "reset", label: "Reset lokalizacji", icon: RotateCcw, color: "bg-red-500" },
];

export const Route = createFileRoute("/mobile/locations")({ component: LocationsPage });

function LocationsPage() {
  const auth = useAuth();
  const isAdmin = auth.user?.role === "admin";
  const [mode, setMode] = useState<Mode>("assign");
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [lastLocation, setLastLocation] = useState<string | null>(() =>
    localStorage.getItem(LAST_LOC_KEY),
  );
  const [stockInfo, setStockInfo] = useState<{
    location: string;
    assigned: number;
    inSubiekt: number;
  } | null>(null);
  const [transferSource, setTransferSource] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [resetLocation, setResetLocation] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const totalQty = basket.reduce((s, b) => s + b.qty, 0);
  const currentMode = MODES.find((m) => m.key === mode)!;

  // ── Handle submit from ScanHeader ──
  const handleSubmit = useCallback(
    async (code: string): Promise<boolean> => {
      const loc = parseLocation(code);

      // Location code — set target
      if (loc) {
        if (mode === "reset") {
          if (!resetLocation) {
            setResetLocation(loc.raw);
            toast.success(`Reset na: ${loc.raw}`);
            return true;
          }
          if (resetLocation === loc.raw && basket.length > 0) {
            return true; // duplicate — silently accept
          }
          toast.error(`Oczekiwano: ${resetLocation}`);
          return false;
        }

        if (mode === "transfer") {
          if (!transferSource) {
            setTransferSource(loc.raw);
            toast.success(`Źródło: ${loc.raw}`);
            return true;
          }
          if (!transferTarget && basket.length > 0) {
            setTransferTarget(loc.raw);
            toast.success(`Cel: ${loc.raw}`);
            return true;
          }
          toast.error("Najpierw zeskanuj towary");
          return false;
        }

        // Assign mode
        if (basket.length === 0) {
          toast.error("Najpierw zeskanuj towary");
          return false;
        }
        setPendingLocation(loc.raw);
        setLastLocation(loc.raw);
        localStorage.setItem(LAST_LOC_KEY, loc.raw);
        return true;
      }

      // EAN — add to basket
      const existing = basket.find((b) => b.code === code);
      if (existing) {
        setBasket((b) => b.map((i) => (i.code === code ? { ...i, qty: i.qty + 1 } : i)));
      } else {
        const product = await lookupProduct(code);
        setBasket((b) => [...b, { code, name: product?.name, qty: 1 }]);
      }
      toast.success(`Dodano: ${code}`, { duration: 800 });
      return true;
    },
    [mode, basket, resetLocation, transferSource, transferTarget],
  );

  const removeItem = (code: string) => setBasket((b) => b.filter((i) => i.code !== code));
  const updateQty = (code: string, delta: number) => {
    setBasket(
      (b) =>
        b
          .map((i) => {
            if (i.code !== code) return i;
            const q = Math.max(0, i.qty + delta);
            return q === 0 ? null : { ...i, qty: q };
          })
          .filter(Boolean) as BasketItem[],
    );
  };

  // ── Save / Transfer / Reset ──
  const handleSave = async () => {
    if (!pendingLocation || basket.length === 0) return;
    setSaving(true);
    try {
      const codes = basket.flatMap((b) => Array(b.qty).fill(b.code));
      const result = await assignProducts(codes, pendingLocation);
      if (result.ok) {
        beep(1000, 80);
        setTimeout(() => beep(1200, 120), 100);
        toast.success(`Przypisano ${result.totalQuantity} do ${result.location}`, {
          duration: 3000,
        });
        setHistory((h) =>
          [
            {
              codes: codes.slice(),
              location: pendingLocation,
              timestamp: Date.now(),
              products: result.products || [],
            },
            ...h,
          ].slice(0, 5),
        );
        try {
          const sr = await fetch(
            `/api/locations/verify?location=${encodeURIComponent(pendingLocation)}`,
          );
          const st = await sr.json();
          if (st.comparison) setStockInfo(st.comparison);
        } catch {
          /* ignore */
        }
        setBasket([]);
      } else {
        beep(200, 400);
        toast.error(result.error || "Błąd");
        if (result.notFound?.length) toast.error(`Nie znaleziono: ${result.notFound.join(", ")}`);
        return;
      }
    } catch (e: unknown) {
      beep(200, 400);
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
      for (const item of basket) await addScanToQueue(item.code, pendingLocation);
      toast.warning("Offline — zapisano w kolejce");
    } finally {
      setSaving(false);
      setPendingLocation(null);
    }
  };

  const handleTransfer = async () => {
    if (!transferSource || !transferTarget || basket.length === 0) return;
    setTransferring(true);
    try {
      const codes = basket.flatMap((b) => Array(b.qty).fill(b.code));
      const r = await fetch("/api/locations/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes, fromLocation: transferSource, toLocation: transferTarget }),
      });
      if (r.ok) {
        const d = await r.json();
        beep(1000, 80);
        toast.success(`Przeniesiono ${d.moved} ${transferSource} → ${transferTarget}`);
        setBasket([]);
        setTransferSource(null);
        setTransferTarget(null);
      } else {
        beep(200, 400);
        toast.error((await r.json()).error);
      }
    } catch (e: unknown) {
      beep(200, 400);
      toast.error(e instanceof Error ? e.message : "Błąd przenoszenia");
    } finally {
      setTransferring(false);
    }
  };

  const handleReset = async () => {
    if (!resetLocation || basket.length === 0) return;
    setResetting(true);
    try {
      const codes = basket.flatMap((b) => Array(b.qty).fill(b.code));
      const r = await fetch("/api/locations/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes, location: resetLocation }),
      });
      if (r.ok) {
        const d = await r.json();
        toast.success(`Reset: ${d.reset} → ${resetLocation}`);
        setBasket([]);
        setResetLocation(null);
      } else toast.error((await r.json()).error);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Błąd resetu");
    } finally {
      setResetting(false);
    }
  };

  const handleUndo = async (entry: HistoryEntry) => {
    setUndoing(true);
    try {
      const r = await fetch("/api/locations/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: entry.location, codes: entry.codes }),
      });
      if (r.ok) {
        beep(600, 150);
        toast.success("Cofnięto");
        setHistory((h) => h.filter((e) => e.timestamp !== entry.timestamp));
      } else {
        beep(200, 300);
        toast.error("Nie udało się cofnąć");
      }
    } catch {
      beep(200, 300);
      toast.error("Błąd");
    } finally {
      setUndoing(false);
    }
  };

  const handleLastLocation = () => {
    if (!lastLocation) return;
    setPendingLocation(lastLocation);
  };

  const clearMode = () => {
    setBasket([]);
    setPendingLocation(null);
    setTransferSource(null);
    setTransferTarget(null);
    setResetLocation(null);
    setStockInfo(null);
  };

  // ── Tools (page-specific) ──
  const tools: ScanHeaderTool[] = MODES.filter((m) => m.key !== "reset" || isAdmin).map((m) => ({
    key: m.key,
    label: m.label,
    icon: <m.icon className="h-5 w-5" />,
    color: m.color,
    active: mode === m.key,
    onClick: () => {
      setMode(m.key);
      clearMode();
    },
  }));

  // ── Hint text ──
  const hint = (() => {
    if (mode === "assign") {
      if (pendingLocation) return "Zeskanuj więcej lub potwierdź poniżej";
      return basket.length > 0
        ? `🔵 Koszyk: ${totalQty} szt. — zeskanuj lokalizację`
        : "🟢 Skanuj towary (Enter)";
    }
    if (mode === "transfer") {
      if (transferSource && transferTarget && basket.length > 0)
        return "Potwierdź przeniesienie poniżej";
      if (transferSource) return `🔵 Źródło: ${transferSource} — zeskanuj cel`;
      if (basket.length > 0) return "🔵 Zeskanuj lokalizację źródłową";
      return "🟢 Skanuj towary, potem źródło i cel";
    }
    if (mode === "reset") {
      if (resetLocation && basket.length > 0) return "Potwierdź reset poniżej";
      if (resetLocation) return `🔵 Reset do: ${resetLocation} — skanuj towary`;
      return "🟢 Zeskanuj lokalizację docelową";
    }
    return "🟢 Skanuj towary (Enter)";
  })();

  return (
    <div className="flex flex-col min-h-screen">
      <ScanHeader
        pageTitle="Lokalizacje"
        pageSubtitle={currentMode.label}
        onSubmit={handleSubmit}
        hint={hint}
        tools={tools}
      />

      <div className="flex-1 p-3 space-y-3">
        {/* Last location quick button */}
        {lastLocation && basket.length > 0 && !pendingLocation && mode === "assign" && (
          <button
            onClick={handleLastLocation}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-blue-200 bg-blue-50 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 touch-target active:scale-95 transition-all"
          >
            <MapPin className="h-4 w-4" />
            Przypisz do {lastLocation}
          </button>
        )}

        {/* Transfer status */}
        {mode === "transfer" && (
          <div className="flex gap-2 text-xs">
            <div
              className={`flex-1 rounded-lg border px-3 py-2 ${transferSource ? "border-green-300 bg-green-50" : "border-dashed"}`}
            >
              <div className="text-muted-foreground">Źródło</div>
              <div className="font-mono font-bold">{transferSource || "—"}</div>
            </div>
            <div className="flex items-center">→</div>
            <div
              className={`flex-1 rounded-lg border px-3 py-2 ${transferTarget ? "border-blue-300 bg-blue-50" : "border-dashed"}`}
            >
              <div className="text-muted-foreground">Cel</div>
              <div className="font-mono font-bold">{transferTarget || "—"}</div>
            </div>
          </div>
        )}

        {/* Reset status */}
        {mode === "reset" && resetLocation && (
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm font-mono font-bold text-red-700 text-center">
            Reset do: {resetLocation}
          </div>
        )}

        {/* Basket */}
        {basket.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 text-sm font-semibold">
              Koszyk ({totalQty} szt.)
            </div>
            <div className="divide-y max-h-48 overflow-y-auto">
              {basket.map((item) => (
                <div
                  key={item.code}
                  className="flex items-center justify-between px-3 py-1.5 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <span className="font-mono text-xs truncate">{item.code}</span>
                      {item.name && (
                        <span className="text-xs text-muted-foreground ml-1.5 truncate">
                          {item.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQty(item.code, -1)}
                      className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-accent font-mono"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-mono text-xs font-semibold">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.code, 1)}
                      className="touch-target rounded border px-1.5 py-0.5 text-xs hover:bg-accent font-mono"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeItem(item.code)}
                      className="touch-target rounded p-1 hover:bg-accent ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation: assign */}
        {pendingLocation && mode === "assign" && (
          <div className="rounded-lg border-2 border-success bg-success/5 p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-success shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Potwierdź przypisanie</div>
                <div className="mt-1 font-mono text-lg font-bold">{pendingLocation}</div>
                <div className="text-xs text-muted-foreground mt-1">{totalQty} towarów</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground flex-1 justify-center"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {saving ? "Zapisuję…" : "Zapisz"}
                  </button>
                  <button
                    onClick={() => setPendingLocation(null)}
                    className="touch-target rounded-md border px-4 py-2.5 text-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation: transfer */}
        {mode === "transfer" && transferSource && transferTarget && basket.length > 0 && (
          <div className="rounded-lg border-2 border-success bg-success/5 p-4">
            <div className="flex items-start gap-3">
              <ArrowRightLeft className="mt-0.5 h-5 w-5 text-success shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Potwierdź przeniesienie</div>
                <div className="mt-1 font-mono text-sm">
                  {transferSource} → <span className="font-bold">{transferTarget}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{totalQty} towarów</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleTransfer}
                    disabled={transferring}
                    className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground flex-1 justify-center"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {transferring ? "Przenoszę…" : "Wykonaj"}
                  </button>
                  <button
                    onClick={() => {
                      setTransferSource(null);
                      setTransferTarget(null);
                    }}
                    className="touch-target rounded-md border px-4 py-2.5 text-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation: reset */}
        {mode === "reset" && resetLocation && basket.length > 0 && (
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="mt-0.5 h-5 w-5 text-red-600 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm text-red-800">Potwierdź reset</div>
                <div className="mt-1 font-mono text-lg font-bold">{resetLocation}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  ⚠️ Usuwa wszystkie inne lokalizacje dla {totalQty} towarów
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="touch-target inline-flex items-center gap-1.5 rounded-md bg-red-600 px-6 py-2.5 text-sm font-medium text-white flex-1 justify-center"
                  >
                    {resetting ? "Resetuję…" : "Resetuj"}
                  </button>
                  <button
                    onClick={() => setResetLocation(null)}
                    className="touch-target rounded-md border px-4 py-2.5 text-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stock verification */}
        {stockInfo && basket.length === 0 && (
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 text-sm font-semibold mb-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Weryfikacja — {stockInfo.location}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-muted/50 p-2">
                <div className="text-muted-foreground">Przypisane</div>
                <div className="font-bold text-lg">{stockInfo.assigned}</div>
              </div>
              <div className="rounded bg-muted/50 p-2">
                <div className="text-muted-foreground">W Subiekt GT</div>
                <div className="font-bold text-lg">{stockInfo.inSubiekt}</div>
              </div>
            </div>
            <div
              className={`mt-2 text-xs font-medium ${stockInfo.assigned === stockInfo.inSubiekt ? "text-success" : "text-warning"}`}
            >
              {stockInfo.assigned === stockInfo.inSubiekt
                ? "✅ Stan zgodny"
                : `⚠️ Różnica: ${Math.abs(stockInfo.assigned - stockInfo.inSubiekt)} szt.`}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              Ostatnie operacje
            </div>
            <div className="divide-y">
              {history.map((e) => (
                <div key={e.timestamp} className="flex items-center justify-between py-1.5 text-xs">
                  <div className="min-w-0">
                    <span className="font-mono font-semibold">{e.location}</span>
                    <span className="text-muted-foreground ml-2">{e.codes.length} kodów</span>
                  </div>
                  <button
                    onClick={() => handleUndo(e)}
                    disabled={undoing}
                    className="touch-target inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-accent text-destructive"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Cofnij
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty */}
        {basket.length === 0 && !pendingLocation && !stockInfo && history.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
            <p className="text-sm">Zeskanuj EAN lub kod lokalizacji</p>
          </div>
        )}
      </div>
    </div>
  );
}
