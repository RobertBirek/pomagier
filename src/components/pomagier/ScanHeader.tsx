import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRecentCodes } from "@/hooks/use-recent-codes";
import { beep, haptic, cn } from "@/lib/utils";
import { getQueueCount } from "@/lib/offline-queue";
import { scanBus } from "@/lib/scan-bus";
import { CameraScanner } from "@/components/pomagier/CameraScanner";
import {
  Wrench,
  Package,
  RotateCcw,
  Keyboard,
  ScanLine,
  Camera,
  Trash2,
  RefreshCw,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────

export interface ScanHeaderTool {
  key: string;
  label: string;
  icon: ReactNode;
  color?: string;
  onClick: () => void;
  active?: boolean;
}

interface Suggestion {
  code: string;
  name: string;
  barcode: string;
}

interface ScanHeaderProps {
  pageTitle: string;
  pageSubtitle?: string;
  onSubmit: (code: string) => Promise<boolean>;
  placeholder?: string;
  hint?: string;
  tools?: ScanHeaderTool[];
  /** Disable keyboard toggle — set true when keyboard input is never needed (e.g. picking) */
  disableManual?: boolean;
}

// ─── Manual mode persistence ──────────────────────────

const MANUAL_KEY = "pomagier-manual-mode";

function loadManualMode(): boolean {
  try {
    return localStorage.getItem(MANUAL_KEY) === "1";
  } catch {
    return false;
  }
}

function saveManualMode(v: boolean) {
  try {
    localStorage.setItem(MANUAL_KEY, v ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

// ─── Component ────────────────────────────────────────

export function ScanHeader({
  pageTitle,
  pageSubtitle,
  onSubmit,
  placeholder = "Zeskanuj kod",
  hint = "🟢 Zeskanuj kod — Enter aby wysłać",
  tools,
  disableManual,
}: ScanHeaderProps) {
  const auth = useAuth();
  const userId = auth.user?.id;
  const { recentCodes, addRecentCode, clearRecentCodes } = useRecentCodes(userId);

  // ── State ──
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  const [manualMode, setManualMode] = useState<boolean>(loadManualMode);
  const [showTools, setShowTools] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  // ── Autocomplete ──
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Input ref ──
  const inputRef = useRef<HTMLInputElement>(null);
  const refocus = useCallback(() => {
    setTimeout(() => {
      if (!showTools && !showCamera) inputRef.current?.focus();
    }, 50);
  }, [showTools, showCamera]);

  // ── Effects ──
  useEffect(() => {
    refocus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getQueueCount().then(setQueueCount);
    const interval = setInterval(() => getQueueCount().then(setQueueCount), 10000);
    return () => clearInterval(interval);
  }, []);

  // Flash auto-reset
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 500);
    return () => clearTimeout(t);
  }, [flash]);

  // ── Submit logic ──
  const handleSubmitCode = useCallback(
    async (code: string) => {
      if (!code || loading) return;
      setLoading(true);
      setShowSuggestions(false);
      try {
        const ok = await onSubmit(code);
        if (ok) {
          setFlash("ok");
          beep(1000, 80);
          haptic(50);
          addRecentCode(code);
        } else {
          setFlash("err");
          beep(200, 300);
          haptic(200);
        }
      } catch {
        setFlash("err");
        beep(200, 300);
        haptic(200);
      }
      setLoading(false);
      setInputValue("");
      refocus();
    },
    [onSubmit, loading, addRecentCode, refocus],
  );

  // Register in scanBus for programmatic scan triggers
  const handleSubmitCodeRef = useRef(handleSubmitCode);
  handleSubmitCodeRef.current = handleSubmitCode;

  useEffect(() => {
    scanBus.register((code: string) => {
      setInputValue(code);
      setTimeout(() => handleSubmitCodeRef.current(code), 60);
    });
    return () => scanBus.unregister(() => {});
  }, []);

  const handleSubmit = useCallback(async () => {
    await handleSubmitCode(inputValue.trim());
  }, [inputValue, handleSubmitCode]);

  // ── Autocomplete handler ──
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/quick-search?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, []);

  // ── Manual mode toggle ──
  const toggleManualMode = useCallback(() => {
    setManualMode((prev) => {
      const next = !prev;
      saveManualMode(next);
      return next;
    });
    setShowTools(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Camera scan handler ──
  const handleCameraScan = useCallback(
    (code: string) => {
      setShowCamera(false);
      setInputValue(code);
      setTimeout(() => handleSubmitCode(code), 60);
    },
    [handleSubmitCode],
  );

  // ── Repeat last scan ──
  const handleRepeatLast = useCallback(() => {
    const last = recentCodes[0];
    if (last) {
      setShowTools(false);
      setInputValue(last);
      setTimeout(() => handleSubmitCode(last), 60);
    }
  }, [recentCodes, handleSubmitCode]);

  // ── Styling classes ──
  const inputBorderClass = cn(
    "w-full rounded-lg border-2 bg-background px-4 py-3 text-center text-lg font-mono shadow-inner outline-none transition-all duration-200",
    flash === "ok" && "border-green-500 bg-green-50 ring-2 ring-green-500/20",
    flash === "err" && "border-red-400 bg-red-50 ring-2 ring-red-400/20",
    !flash && manualMode && "border-blue-400 focus:border-blue-500 focus:ring-blue-500/20",
    !flash && !manualMode && "border-primary/40 focus:border-primary focus:ring-primary/20",
  );

  const hintText = manualMode && !flash ? "⌨️ Wpisz ręcznie — Enter aby wysłać" : hint;

  const modalOpen = showTools || showCamera;

  // ── Render ──
  return (
    <>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 bg-card border-b shadow-sm">
        {/* Title row */}
        <div className="px-3 pb-1 pt-1">
          <h1 className="text-sm font-bold leading-tight">
            {pageTitle}
            {pageSubtitle && (
              <span className="text-muted-foreground font-normal ml-1.5">· {pageSubtitle}</span>
            )}
          </h1>
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2 px-3 pb-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode={manualMode ? "text" : "none"}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setShowSuggestions(false);
                  handleSubmit();
                }
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={manualMode && !flash ? "Wpisz kod ręcznie…" : placeholder}
              autoComplete="off"
              disabled={loading}
              className={inputBorderClass}
              aria-label="Skaner kodów"
              data-testid="scan-input"
            />

            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border bg-card shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.code}-${i}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setInputValue(s.barcode || s.code);
                      setShowSuggestions(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent touch-target border-b last:border-0"
                  >
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs font-semibold truncate">
                        {s.barcode || s.code}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{s.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tools button */}
          <button
            onClick={() => setShowTools(true)}
            className="shrink-0 grid place-items-center rounded-lg w-10 h-10 bg-muted hover:bg-accent active:scale-95 transition-transform"
            data-testid="tools-button"
            aria-label="Narzędzia"
          >
            <Wrench className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Hint text */}
        <p className="text-center text-xs text-muted-foreground pb-1.5 px-3">
          {loading ? "⏳ Szukam…" : hintText}
        </p>
      </div>

      {/* ── Tools modal ── */}
      {showTools && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowTools(false)}
        >
          <div
            className="w-72 max-h-[80vh] overflow-y-auto rounded-xl bg-card p-4 shadow-xl space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold">Narzędzia</span>
              <button
                onClick={() => setShowTools(false)}
                className="touch-target rounded p-1 hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Repeat last scan */}
            {recentCodes.length > 0 && (
              <button
                onClick={handleRepeatLast}
                className="w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold hover:bg-accent transition-colors touch-target"
              >
                <RotateCcw className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div>Powtórz ostatni</div>
                  <div className="text-xs text-muted-foreground font-mono truncate font-normal">
                    {recentCodes[0]}
                  </div>
                </div>
              </button>
            )}

            {/* Toggle manual mode */}
            {!disableManual && (
              <button
                onClick={toggleManualMode}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold hover:bg-accent transition-colors touch-target",
                  manualMode && "bg-primary/10 text-primary",
                )}
              >
                <Keyboard className="h-5 w-5" />
                <span>{manualMode ? "Tryb skanera" : "Wpisz ręcznie"}</span>
              </button>
            )}

            {/* Camera scanner */}
            <button
              onClick={() => {
                setShowTools(false);
                setShowCamera(true);
              }}
              className="w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold hover:bg-accent transition-colors touch-target"
            >
              <Camera className="h-5 w-5" />
              Skanuj kamerą
            </button>

            {/* Recent codes */}
            {recentCodes.length > 0 && (
              <>
                <div className="pt-2 pb-1 px-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ostatnie kody
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentCodes.slice(0, 8).map((code) => (
                    <button
                      key={code}
                      onMouseDown={() => {
                        setShowTools(false);
                        setInputValue(code);
                        setTimeout(() => handleSubmitCode(code), 60);
                      }}
                      className="rounded-full border bg-card px-3 py-1.5 text-xs font-mono hover:bg-accent active:scale-95 transition-all touch-target"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Page-specific tools */}
            {tools && tools.length > 0 && (
              <>
                <hr className="my-2" />
                {tools.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => {
                      t.onClick();
                      setShowTools(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold hover:bg-accent transition-colors touch-target",
                      t.active &&
                        (t.color ? `${t.color} text-white` : "bg-primary/10 text-primary"),
                    )}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </>
            )}

            {/* Queue indicator */}
            {queueCount > 0 && (
              <>
                <hr className="my-2" />
                <div className="flex items-center gap-2 px-1 text-xs text-amber-600">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{queueCount} oczekujących w kolejce offline</span>
                </div>
              </>
            )}

            {/* Clear history */}
            {recentCodes.length > 0 && (
              <>
                <hr className="my-2" />
                <button
                  onClick={() => {
                    clearRecentCodes();
                    setShowTools(false);
                  }}
                  className="w-full flex items-center gap-2 rounded-lg p-2 text-left text-xs text-destructive hover:bg-destructive/10 transition-colors touch-target"
                >
                  <Trash2 className="h-4 w-4" />
                  Wyczyść historię
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Camera scanner overlay ── */}
      {showCamera && (
        <CameraScanner
          onScan={handleCameraScan}
          onClose={() => {
            setShowCamera(false);
            setTimeout(() => inputRef.current?.focus(), 200);
          }}
        />
      )}
    </>
  );
}

export { Wrench, ScanLine, Package } from "lucide-react";
