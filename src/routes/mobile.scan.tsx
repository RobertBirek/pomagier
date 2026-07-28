import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useScanFocus } from "@/hooks/use-scan-focus";
import { useAuth } from "@/lib/auth";
import { parseLocation } from "@/lib/locations";
import { addScanToQueue } from "@/lib/offline-queue";
import { beep, cn } from "@/lib/utils";
import { useMssqlStatus } from "@/lib/use-status";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";
import { ScanLine, Package, MapPin, Wifi, WifiOff, ChevronRight, RotateCcw } from "lucide-react";

const RECENT_KEY = "pomagier-recent-codes";

function loadRecent(userId: string): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const stored: { codes: string[]; userId: string; savedAt: number } = JSON.parse(raw);
    if (stored.userId !== userId) return [];
    if (Date.now() - stored.savedAt > 30 * 60 * 1000) return [];
    return stored.codes;
  } catch {
    return [];
  }
}

function saveRecent(codes: string[], userId: string) {
  try {
    if (codes.length === 0) {
      localStorage.removeItem(RECENT_KEY);
    } else {
      localStorage.setItem(RECENT_KEY, JSON.stringify({ codes, userId, savedAt: Date.now() }));
    }
  } catch {
    /* storage unavailable */
  }
}

interface ScanResultItem {
  code: string;
  type: "product" | "location";
  name?: string;
  stocks?: { warehouseName: string; quantity: number }[];
  location?: string;
  locationLabel?: string;
}

export const Route = createFileRoute("/mobile/scan")({ component: ScanPage });

function ScanPage() {
  const nav = useNavigate();
  const { inputRef, refocus } = useScanFocus();
  const { online } = useMssqlStatus();
  const { user } = useAuth();
  const currentUserId = user?.id || "";
  const [inputValue, setInputValue] = useState("");
  const [lastResult, setLastResult] = useState<ScanResultItem | null>(null);
  const [recentCodes, setRecentCodes] = useState<string[]>(() => loadRecent(currentUserId));
  const [inputFlash, setInputFlash] = useState<"ok" | "err" | null>(null);
  const [loading, setLoading] = useState(false);

  // Persist recent codes
  useEffect(() => {
    saveRecent(recentCodes, currentUserId);
  }, [recentCodes, currentUserId]);

  const flash = (kind: "ok" | "err") => {
    setInputFlash(kind);
    setTimeout(() => setInputFlash(null), 500);
  };

  const addRecent = (code: string) => {
    setRecentCodes((prev) => {
      const next = [code, ...prev.filter((c) => c !== code)].slice(0, 5);
      return next;
    });
  };

  const handleScan = useCallback(
    async (codeOverride?: string) => {
      const code = (codeOverride ?? inputValue).trim();
      if (!code || loading) return;
      setInputValue("");
      setLoading(true);
      setLastResult(null);
      beep(800, 100);

      const loc = parseLocation(code);
      if (loc) {
        addRecent(code);
        flash("ok");
        setLastResult({
          code,
          type: "location",
          location: loc.raw,
          locationLabel: loc.label,
        });
        setLoading(false);
        refocus();
        return;
      }

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.found) {
            addRecent(code);
            flash("ok");
            beep(1000, 80);
            const product = data.products[0];
            setLastResult({
              code,
              type: "product",
              name: product.name,
              stocks: product.stocks?.map((s: any) => ({
                warehouseName: s.warehouseName,
                quantity: s.quantity,
              })),
              location: product.description || undefined,
            });
          } else {
            flash("err");
            beep(200, 300);
            toast.error("Nie znaleziono", { description: code });
          }
        } else {
          flash("err");
          beep(200, 300);
        }
      } catch {
        await addScanToQueue(code);
        flash("err");
        beep(200, 300);
        toast.warning("Offline — zapisano w kolejce", { description: code });
      }
      setLoading(false);
      refocus();
    },
    [inputValue, loading],
  );

  const handleOpenProduct = () => {
    if (lastResult?.type === "product") {
      nav({ to: "/mobile/product/$code", params: { code: lastResult.code } });
    } else if (lastResult?.type === "location") {
      nav({ to: "/mobile/location/$code", params: { code: lastResult.location! } });
    }
  };

  const inputBorderClass = cn(
    "w-full rounded-lg border-2 bg-background px-4 py-5 text-center text-lg font-mono shadow-inner outline-none transition-all duration-200",
    inputFlash === "ok" && "border-green-500 bg-green-50 ring-2 ring-green-500/20",
    inputFlash === "err" && "border-red-400 bg-red-50 ring-2 ring-red-400/20",
    !inputFlash && "border-primary/40 focus:border-primary focus:ring-primary/20",
  );

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Skaner</h1>
        <div className="flex items-center gap-1.5 text-xs">
          {online ? (
            <span className="inline-flex items-center gap-1 text-green-600">
              <Wifi className="h-3 w-3" /> Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
        </div>
      </div>

      {/* Scan input */}
      <div className="relative">
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleScan();
          }}
          placeholder="Zeskanuj lub wpisz kod EAN / lokalizację"
          autoComplete="off"
          disabled={loading}
          className={inputBorderClass}
        />
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {loading ? "⏳ Szukam…" : "🟢 Zeskanuj kod — wynik pokaże się poniżej"}
        </p>
      </div>

      {/* Inline result */}
      {lastResult && (
        <button
          onClick={handleOpenProduct}
          className="w-full rounded-lg border bg-card p-4 text-left hover:bg-accent active:scale-[0.98] transition-all touch-target"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {lastResult.type === "product" ? (
                <Package className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              ) : (
                <MapPin className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-mono text-xs text-muted-foreground mb-0.5">
                  {lastResult.code}
                </div>
                {lastResult.type === "product" ? (
                  <>
                    <div className="font-semibold text-sm truncate">{lastResult.name}</div>
                    {lastResult.stocks && lastResult.stocks.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {lastResult.stocks.slice(0, 2).map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                          >
                            <span className="text-muted-foreground">{s.warehouseName}:</span>
                            <span className="font-semibold">{s.quantity} szt.</span>
                          </span>
                        ))}
                        {lastResult.stocks.length > 2 && (
                          <span className="text-xs text-muted-foreground self-center">
                            +{lastResult.stocks.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="font-semibold text-sm">
                    Lokalizacja: {lastResult.locationLabel}
                  </div>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />
          </div>
        </button>
      )}

      {/* Recent codes */}
      {recentCodes.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RotateCcw className="h-3 w-3" />
            Ostatnie kody:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentCodes.map((code) => (
              <button
                key={code}
                onClick={() => handleScan(code)}
                disabled={loading}
                className="touch-target rounded-full border bg-card px-3 py-1.5 text-xs font-mono hover:bg-accent active:scale-95 transition-all disabled:opacity-50"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!lastResult && recentCodes.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <ScanLine className="h-16 w-16 text-muted-foreground/15" />
        </div>
      )}
    </div>
  );
}
