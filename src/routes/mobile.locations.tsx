import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
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
  History,
  RotateCcw,
  ArrowRightLeft,
  Eraser,
} from "lucide-react";
import type { BasketItem } from "@/hooks/use-basket";
import { useBasket } from "@/hooks/use-basket";
import { BasketPanel } from "@/components/pomagier/BasketPanel";

interface HistoryEntry {
  codes: string[];
  location: string;
  timestamp: number;
  products: { id: number; symbol: string }[];
}

const LAST_LOC_KEY = "pomagier-last-location";

type Mode = "assign" | "transfer" | "reset" | "clear";

async function assignProducts(codes: string[], location: string) {
  const r = await fetch("/api/locations/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codes, location }),
  });
  return r.json();
}

async function lookupProduct(code: string, warehouseId?: number) {
  try {
    const r = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, warehouse: warehouseId }),
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
  { key: "clear", label: "Wyczyść lokalizacje", icon: Eraser, color: "bg-red-700" },
];

export const Route = createFileRoute("/mobile/locations")({
  component: LocationsPage,
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    ...(typeof search.code === "string" ? { code: search.code } : {}),
  }),
});

function LocationsPage() {
  const auth = useAuth();
  const nav = useNavigate();
  const isAdmin = auth.user?.role === "admin";
  const [mode, setMode] = useState<Mode>("assign");
  const { basket, totalQty, flatCodes, addToBasket, removeItem, updateQty, clearBasket } =
    useBasket();
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [undoing, setUndoing] = useState(false);
  const [lastLocation, setLastLocation] = useState<string | null>(() =>
    localStorage.getItem(LAST_LOC_KEY),
  );
  const [showResult, setShowResult] = useState<{
    location: string;
    products: { symbol: string; name: string; quantity: number }[];
  } | null>(null);
  const [transferSource, setTransferSource] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [resetLocation, setResetLocation] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearIdempotencyKey, setClearIdempotencyKey] = useState<string | null>(null);
  const [flashCodes, setFlashCodes] = useState<Set<string>>(new Set());

  const currentMode = MODES.find((m) => m.key === mode)!;

  // Pre-fill basket from search params (e.g. from product card "Przenieś")
  const { code: prefillCode } = Route.useSearch();
  useEffect(() => {
    const fill = async () => {
      if (!prefillCode || basket.length > 0) return;
      // Sprint 4 fix: pass warehouse so /api/scan returns product details
      const product = await lookupProduct(prefillCode, auth.warehouse?.id);
      if (product) {
        await addToBasket(prefillCode);
      }
    };
    fill();
    // run once on mount with code param
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCode]);

  // ── Handle submit from ScanHeader ──
  const handleSubmit = useCallback(
    async (code: string): Promise<boolean> => {
      const loc = parseLocation(code);

      // Location code — set target
      if (loc) {
        if (mode === "clear") {
          toast.error("Tryb czyszczenia nie używa kodu lokalizacji");
          return false;
        }
        if (mode === "reset") {
          if (!resetLocation) {
            setResetLocation(loc.raw);
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
            return true;
          }
          if (!transferTarget && basket.length > 0) {
            setTransferTarget(loc.raw);
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
      await addToBasket(code);
      // Flash animation for newly added item
      setFlashCodes((prev) => new Set(prev).add(code));
      setTimeout(() => {
        setFlashCodes((prev) => {
          const next = new Set(prev);
          next.delete(code);
          return next;
        });
      }, 800);
      return true;
    },
    [mode, basket, resetLocation, transferSource, transferTarget, addToBasket],
  );

  // ── Save / Transfer / Reset ──
  const handleSaveClick = () => {
    if (!pendingLocation || basket.length === 0) return;
    setConfirmSave(true);
  };

  const handleSave = async () => {
    setConfirmSave(false);
    if (!pendingLocation || basket.length === 0) return;
    setSaving(true);
    try {
      const codes = basket.flatMap((b) => Array(b.qty).fill(b.code));
      const result = await assignProducts(codes, pendingLocation);
      if (result.ok) {
        beep(1000, 80);
        setTimeout(() => beep(1200, 120), 100);
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
        setShowResult({ location: pendingLocation, products: result.products || [] });
        clearBasket();
      } else {
        beep(200, 400);
        toast.error(result.error || "Błąd");
        if (result.notFound?.length) toast.error(`Nie znaleziono: ${result.notFound.join(", ")}`);
        return;
      }
    } catch (e: unknown) {
      beep(200, 400);
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
      for (const item of basket)
        await addScanToQueue(
          item.code,
          pendingLocation,
          auth.warehouse?.id,
          auth.user?.subiektUzId,
        );
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
        beep(1000, 80);
        clearBasket();
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
        clearBasket();
        setResetLocation(null);
      } else toast.error((await r.json()).error);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Błąd resetu");
    } finally {
      setResetting(false);
    }
  };

  const handleClear = async () => {
    if (basket.length === 0) return;
    setClearing(true);
    try {
      const codes = basket.flatMap((b) => Array(b.qty).fill(b.code));
      const operationKey = clearIdempotencyKey ?? crypto.randomUUID();
      if (!clearIdempotencyKey) setClearIdempotencyKey(operationKey);
      const r = await fetch("/api/locations/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": operationKey },
        body: JSON.stringify({ codes, method: "mobile" }),
      });
      const result = (await r.json()) as {
        ok?: boolean;
        cleared?: number;
        notFound?: string[];
        error?: string;
      };
      if (!r.ok || !result.ok) {
        beep(200, 400);
        toast.error(result.error || "Błąd czyszczenia lokalizacji");
        return;
      }
      beep(1000, 80);
      clearBasket();
      setClearIdempotencyKey(null);
      toast.success(`Wyczyszczono lokalizacje: ${result.cleared ?? 0}`);
      if (result.notFound?.length) toast.warning(`Nie znaleziono: ${result.notFound.join(", ")}`);
    } catch (e: unknown) {
      beep(200, 400);
      toast.error(e instanceof Error ? e.message : "Błąd czyszczenia lokalizacji");
    } finally {
      setClearing(false);
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

  const clearMode = () => {
    clearBasket();
    setPendingLocation(null);
    setTransferSource(null);
    setTransferTarget(null);
    setResetLocation(null);
    setClearIdempotencyKey(null);
    setShowResult(null);
  };

  const handleNavigateToProduct = useCallback(
    (code: string) => {
      nav({ to: "/mobile/product/$code", params: { code } });
    },
    [nav],
  );

  // ── Tools (page-specific) ──
  const tools: ScanHeaderTool[] = MODES.filter(
    (m) => (m.key !== "reset" && m.key !== "clear") || isAdmin,
  ).map((m) => ({
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
    if (mode === "clear") {
      return basket.length > 0
        ? "Potwierdź czyszczenie poniżej"
        : "🟢 Skanuj towary do wyczyszczenia";
    }
    return "🟢 Skanuj towary (Enter)";
  })();

  return (
    <div className="flex flex-col min-h-screen">
      <ScanHeader onSubmit={handleSubmit} hint={hint} tools={tools} />

      <div className="flex-1 p-3 space-y-3">
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

        {mode === "clear" && basket.length > 0 && (
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <Eraser className="mt-0.5 h-5 w-5 text-red-700 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-sm text-red-900">
                  Potwierdź czyszczenie lokalizacji
                </div>
                <div className="text-xs text-red-800 mt-1">
                  ⚠️ Wszystkie lokalizacje zostaną usunięte dla {totalQty} szt. produktów.
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleClear}
                    disabled={clearing}
                    className="touch-target inline-flex items-center gap-1.5 rounded-md bg-red-700 px-6 py-2.5 text-sm font-medium text-white flex-1 justify-center"
                  >
                    <Eraser className="h-4 w-4" />
                    {clearing ? "Czyszczę…" : "Wyczyść"}
                  </button>
                  <button
                    onClick={() => {
                      clearBasket();
                      setClearIdempotencyKey(null);
                    }}
                    disabled={clearing}
                    className="touch-target rounded-md border px-4 py-2.5 text-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Basket */}
        <BasketPanel
          items={basket}
          totalQty={totalQty}
          onUpdateQty={updateQty}
          onRemove={removeItem}
          onClear={() => {
            clearBasket();
            setPendingLocation(null);
          }}
          onNavigate={handleNavigateToProduct}
        />

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
                    onClick={handleSaveClick}
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

        {/* Confirm save modal */}
        {confirmSave && pendingLocation && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setConfirmSave(false)}
          >
            <div
              className="mx-4 w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-xl bg-card p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-bold mb-3">
                Przypisać {basket.length}{" "}
                {basket.length === 1 ? "produkt" : basket.length < 5 ? "produkty" : "produktów"} do:
              </div>
              <div className="font-mono text-lg font-bold mb-3">{pendingLocation}</div>

              <div className="divide-y border rounded-lg max-h-48 overflow-y-auto mb-3">
                {basket.map((item) => (
                  <div key={item.code} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-[13px] break-all leading-tight">
                        {item.code}
                      </div>
                      {item.name && (
                        <div className="text-xs text-muted-foreground truncate">{item.name}</div>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                      ×{item.qty}
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground text-center mb-3">
                Łącznie: {totalQty} szt.
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 touch-target rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saving ? "Zapisuję…" : "Potwierdź"}
                </button>
                <button
                  onClick={() => setConfirmSave(false)}
                  className="touch-target rounded-md border px-4 py-2.5 text-sm"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result modal */}
        {showResult && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowResult(null)}
          >
            <div
              className="mx-4 w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-xl bg-card p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Zapisano
                </div>
                <button
                  onClick={() => setShowResult(null)}
                  className="touch-target rounded p-1 hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="text-xs text-muted-foreground mb-3">
                Lokalizacja:{" "}
                <span className="font-mono font-bold text-foreground">{showResult.location}</span>
              </div>

              <div className="divide-y border rounded-lg max-h-48 overflow-y-auto mb-3">
                {showResult.products.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-[13px] break-all leading-tight">
                        {p.symbol}
                      </div>
                      {p.name && (
                        <div className="text-xs text-muted-foreground truncate">{p.name}</div>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                      ×{p.quantity}
                    </span>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground text-center">
                Produktów: {showResult.products.length} · Ilość:{" "}
                {showResult.products.reduce((s, p) => s + p.quantity, 0)}
              </div>

              <button
                onClick={() => setShowResult(null)}
                className="mt-3 w-full touch-target rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
              >
                OK
              </button>
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
        {basket.length === 0 && !pendingLocation && !showResult && history.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
            <p className="text-sm">Zeskanuj EAN lub kod lokalizacji</p>
          </div>
        )}
      </div>
    </div>
  );
}
