import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { MobileShell } from "@/components/pomagier/MobileShell";
import { useState, useRef, useEffect } from "react";
import { parseLocation } from "@/lib/locations";
import { toast } from "sonner";
import { MapPin, ArrowRightLeft, RotateCcw, Package, X, CheckCircle2, Trash2, History } from "lucide-react";

const MODES = [
  { key: "assign" as const, label: "Przypisz towary", icon: MapPin, color: "bg-blue-500" },
  { key: "transfer" as const, label: "Przenieś towary", icon: ArrowRightLeft, color: "bg-amber-500" },
  { key: "reset" as const, label: "Reset lokalizacji", icon: RotateCcw, color: "bg-red-500" },
];

function LocationsHeader() {
  const auth = useAuth();
  const isAdmin = auth.user?.role === "admin";
  const [mode, setMode] = useState<"assign"|"transfer"|"reset">("assign");
  const [showModeModal, setShowModeModal] = useState(false);
  const currentMode = MODES.find(m => m.key === mode)!;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="border-t bg-card/50">
      {/* Title + mode */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <h1 className="text-xs font-bold">Lokalizacje · <span className="text-muted-foreground font-normal">{currentMode.label}</span></h1>
      </div>
      {/* Input row */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <input ref={inputRef} placeholder="Skanuj EAN lub lokalizację..." autoComplete="off" className="flex-1 rounded-lg border-2 border-primary/40 bg-background px-4 py-2.5 text-sm font-mono font-bold shadow-inner outline-none focus:border-primary" />
        <button onClick={() => setShowModeModal(true)} className={`shrink-0 grid place-items-center rounded-lg w-10 h-10 ${currentMode.color} text-white shadow active:scale-95 transition-transform`}>
          <currentMode.icon className="h-5 w-5" />
        </button>
      </div>
      {/* Mode modal */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModeModal(false)}>
          <div className="w-56 rounded-xl bg-card p-3 shadow-xl space-y-1.5" onClick={e => e.stopPropagation()}>
            <div className="text-xs font-bold mb-1">Tryb działania</div>
            {MODES.filter(m => m.key !== "reset" || isAdmin).map(m => (
              <button key={m.key} onClick={() => { setMode(m.key); setShowModeModal(false); }} className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-left text-xs font-semibold ${mode === m.key ? `${m.color} text-white` : "hover:bg-accent"}`}>
                <m.icon className="h-4 w-4" />{m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileLayout() {
  const pathname = useRouterState({ select: r => r.location.pathname });
  const isLocations = pathname === "/mobile/locations" || pathname.startsWith("/mobile/locations");

  return (
    <AuthProvider>
      <MobileShell headerSlot={isLocations ? <LocationsHeader /> : undefined} />
    </AuthProvider>
  );
}
