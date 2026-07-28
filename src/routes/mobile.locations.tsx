import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { parseLocation } from "@/lib/locations";
import { addScanToQueue } from "@/lib/offline-queue";
import { LocationPicker } from "@/components/pomagier/LocationPicker";
import { ScanInput } from "@/components/pomagier/ScanInput";
import { BasketPanel } from "@/components/pomagier/BasketPanel";
import { ConfirmCard } from "@/components/pomagier/ConfirmCard";
import { HistoryPanel } from "@/components/pomagier/HistoryPanel";
import { useBasket } from "@/hooks/use-basket";
import { useScanFocus } from "@/hooks/use-scan-focus";
import { useLocationMemory } from "@/hooks/use-location-memory";
import { beep } from "@/lib/utils";
import {
  MapPin,
  Package,
  X,
  ChevronDown,
  ArrowRightLeft,
  BarChart3,
  MoveRight,
  Trash2,
} from "lucide-react";

interface HistoryEntry {
  codes: string[];
  location: string;
  timestamp: number;
  products: { id: number; symbol: string }[];
}

interface DuplicateItem {
  productId: number;
  symbol: string;
  name: string;
  locations: { code: string; quantity: number }[];
  suggestion: string;
}

export const Route = createFileRoute("/mobile/locations")({ component: LocationsPage });

function LocationsPage() {
  // --- Hooks ---
  const { basket, totalQty, flatCodes, addToBasket, removeItem, updateQty, clearBasket } =
    useBasket();
  const { inputRef, refocus } = useScanFocus();
  const { lastLocation, remember } = useLocationMemory();

  // --- State ---
  const [inputValue, setInputValue] = useState("");
  const [pendingLocation, setPendingLocation] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Modes
  const [transferMode, setTransferMode] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetLocation, setResetLocation] = useState<string | null>(null);

  // Transfer
  const [transferSource, setTransferSource] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);

  // Loading states
  const [saving, setSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Data panels
  const [showPicker, setShowPicker] = useState(false);
  const [stockInfo, setStockInfo] = useState<{
    location: string;
    assigned: number;
    inSubiekt: number;
  } | null>(null);
  const [hasLocation, setHasLocation] = useState<{
    code: string;
    locations: string[];
  } | null>(null);

  // --- Derived ---
  const mode: "scan" | "locate" =
    basket.length > 0 && !pendingLocation && !(transferMode && transferTarget) ? "locate" : "scan";

  const getPlaceholder = () => {
    if (transferMode && !transferSource) return "Zeskanuj lokalizację źródłową...";
    if (transferMode && transferSource && !transferTarget)
      return "Skanuj towary, potem lokalizację celu...";
    return mode === "scan" ? "Zeskanuj EAN towaru..." : "Teraz zeskanuj lokalizację";
  };

  // --- Data loading ---

  // --- Helpers ---
  const idempotencyKey = useCallback(() => crypto.randomUUID(), []);

  const checkExistingLocation = async (code: string) => {
    try {
      const res = await fetch(`/api/locations/check-product?code=${encodeURIComponent(code)}`);
      if (res.ok) {
        const { found, locations } = await res.json();
        if (found) setHasLocation({ code, locations });
      }
    } catch {
      /* stock verification is non-critical — silently ignore */
    }
  };

  // --- Scan handler ---
  const handleScan = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setInputValue("");

    const loc = parseLocation(trimmed);

    if (loc) {
      // --- Location scanned ---
      if (resetMode) {
        if (!resetLocation) {
          setResetLocation(loc.raw);
          toast.success(`Reset na: ${loc.raw}`, { duration: 1500 });
          refocus();
          return;
        }
        return; // Handled by ConfirmCard
      }

      if (transferMode) {
        if (!transferSource) {
          setTransferSource(loc.raw);
          toast.success(`Źródło: ${loc.raw}`, { duration: 1500 });
          refocus();
          return;
        }
        if (!transferTarget && basket.length > 0) {
          setTransferTarget(loc.raw);
          toast.success(`Cel: ${loc.raw}`, { duration: 1500 });
          refocus();
          return;
        }
        beep(200, 300);
        toast.error("Najpierw zeskanuj towary");
        return;
      }

      if (basket.length === 0) {
        beep(200, 300);
        toast.error("Najpierw zeskanuj towary");
        return;
      }

      setPendingLocation(loc.raw);
      remember(loc.raw);
      return;
    }

    // --- Product scanned ---
    await checkExistingLocation(trimmed);
    await addToBasket(trimmed);
    refocus();
  };

  // --- Actions ---
  const handleSave = async () => {
    if (!pendingLocation || basket.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/locations/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey(),
        },
        body: JSON.stringify({ codes: flatCodes, location: pendingLocation }),
      });
      const result = await res.json();

      if (result.ok) {
        beep(1000, 80);
        setTimeout(() => beep(1200, 120), 100);
        toast.success(`Przypisano ${result.totalQuantity} towarów do ${result.location}`, {
          duration: 3000,
        });
        setHistory((h) =>
          [
            {
              codes: flatCodes.slice(),
              location: pendingLocation,
              timestamp: Date.now(),
              products: result.products || [],
            },
            ...h,
          ].slice(0, 5),
        );

        try {
          const stockRes = await fetch(
            `/api/locations/verify?location=${encodeURIComponent(pendingLocation)}`,
          );
          const stock = await stockRes.json();
          if (stock.comparison) setStockInfo(stock.comparison);
        } catch {
          /* ignore — product location check is non-critical */
        }

        clearBasket();
        setPendingLocation(null);
      } else {
        beep(200, 400);
        toast.error(result.error || "Błąd");
        if (result.notFound?.length) toast.error(`Nie znaleziono: ${result.notFound.join(", ")}`);
      }
    } catch {
      beep(200, 400);
      toast.error("Błąd sieci");
      for (const code of flatCodes) {
        await addScanToQueue(code, pendingLocation);
      }
      toast.warning("Offline — zapisano w kolejce", { description: `${basket.length} skanów` });
    } finally {
      setSaving(false);
      refocus();
    }
  };

  const handleUndo = async (entry: HistoryEntry) => {
    setUndoing(true);
    try {
      const res = await fetch("/api/locations/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: entry.location, codes: entry.codes }),
      });
      if (res.ok) {
        beep(600, 150);
        toast.success("Cofnięto ostatnią operację");
        setHistory((h) => h.filter((e) => e.timestamp !== entry.timestamp));
      } else {
        beep(200, 300);
        toast.error("Nie udało się cofnąć");
      }
    } catch {
      beep(200, 300);
      toast.error("Błąd sieci");
    } finally {
      setUndoing(false);
      refocus();
    }
  };

  const handleReset = async () => {
    if (!resetLocation || basket.length === 0) return;
    setResetting(true);
    try {
      const res = await fetch("/api/locations/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey(),
        },
        body: JSON.stringify({ codes: flatCodes, location: resetLocation }),
      });
      const data = await res.json();
      if (res.ok) {
        beep(1000, 80);
        toast.success(`Reset: ${data.reset} towarów → ${resetLocation}`);
        clearBasket();
        setResetLocation(null);
      } else {
        beep(200, 400);
        toast.error(data.error);
      }
    } catch {
      beep(200, 400);
      toast.error("Błąd sieci");
    } finally {
      setResetting(false);
      refocus();
    }
  };

  const handleTransfer = async () => {
    if (!transferSource || !transferTarget || basket.length === 0) return;
    setTransferring(true);
    try {
      const res = await fetch("/api/locations/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey(),
        },
        body: JSON.stringify({
          codes: flatCodes,
          fromLocation: transferSource,
          toLocation: transferTarget,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        beep(1000, 80);
        setTimeout(() => beep(1200, 120), 100);
        toast.success(`Przeniesiono ${data.moved} szt. ${transferSource} → ${transferTarget}`);
        clearBasket();
        setTransferSource(null);
        setTransferTarget(null);
      } else {
        beep(200, 400);
        toast.error(data.error);
      }
    } catch {
      beep(200, 400);
      toast.error("Błąd sieci");
    } finally {
      setTransferring(false);
      refocus();
    }
  };

  const handleLocationPick = (code: string) => {
    setPendingLocation(code);
    remember(code);
    setShowPicker(false);
  };

  const handleLastLocation = () => {
    if (!lastLocation) return;
    setPendingLocation(lastLocation);
  };

  // --- Render ---
  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Przypisz towary</h1>
        {basket.length > 0 && (
          <button
            onClick={clearBasket}
            className="touch-target inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 active:scale-95 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Wyczyść ({totalQty})
          </button>
        )}
      </div>

      {/* Mode toggles */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={transferMode}
          onChange={(e) => setTransferMode(e.target.checked)}
          className="h-4 w-4 rounded border-primary"
        />
        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
        Tryb przenoszenia
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={resetMode}
          onChange={(e) => {
            setResetMode(e.target.checked);
            setResetLocation(null);
          }}
          className="h-4 w-4 rounded border-primary"
        />
        <MapPin className="h-4 w-4 text-muted-foreground" />
        Reset lokalizacji
      </label>

      {/* Reset status */}
      {resetMode && (
        <div className="flex gap-2 text-xs">
          <div
            className={`flex-1 rounded-lg border px-3 py-2 ${resetLocation ? "border-green-300 bg-green-50" : "border-dashed border-muted-foreground/30"}`}
          >
            <div className="text-muted-foreground">Reset do</div>
            <div className="font-mono font-bold">{resetLocation || "—"}</div>
          </div>
        </div>
      )}

      {/* Transfer status */}
      {transferMode && (
        <div className="flex gap-2 text-xs">
          <div
            className={`flex-1 rounded-lg border px-3 py-2 ${transferSource ? "border-green-300 bg-green-50" : "border-dashed border-muted-foreground/30"}`}
          >
            <div className="text-muted-foreground">Źródło</div>
            <div className="font-mono font-bold">{transferSource || "—"}</div>
          </div>
          <div className="flex items-center text-muted-foreground">→</div>
          <div
            className={`flex-1 rounded-lg border px-3 py-2 ${transferTarget ? "border-blue-300 bg-blue-50" : "border-dashed border-muted-foreground/30"}`}
          >
            <div className="text-muted-foreground">Cel</div>
            <div className="font-mono font-bold">{transferTarget || "—"}</div>
          </div>
        </div>
      )}

      {/* Duplicates suggestions */}
      {/* Transfer confirmation */}
      {transferMode && transferSource && transferTarget && basket.length > 0 && (
        <ConfirmCard
          variant="transfer"
          location={transferTarget}
          sourceLocation={transferSource}
          totalQty={totalQty}
          loading={transferring}
          onConfirm={handleTransfer}
          onCancel={() => {
            setTransferSource(null);
            setTransferTarget(null);
            refocus();
          }}
        />
      )}

      {/* Assign confirmation */}
      {pendingLocation && (
        <ConfirmCard
          variant="assign"
          location={pendingLocation}
          totalQty={totalQty}
          loading={saving}
          onConfirm={handleSave}
          onCancel={() => {
            setPendingLocation(null);
            refocus();
          }}
        />
      )}

      {/* History */}
      <HistoryPanel entries={history} loading={undoing} onUndo={handleUndo} />

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
