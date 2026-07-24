import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScanPanel } from "@/components/pomagier/scan";
import { CameraScanner } from "@/components/pomagier/CameraScanner";
import { LocationPicker } from "@/components/pomagier/LocationPicker";
import { parseLocation } from "@/lib/locations";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import { MapPin, Plus, X, Shuffle } from "lucide-react";

async function checkLocationExists(code: string) {
  const res = await fetch(`/api/products-by-location?location=${encodeURIComponent(code)}`);
  const products = await res.json();
  return products.length > 0;
}

async function addLocation(code: string) {
  const res = await fetch("/api/locations", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return res.json();
}

async function fetchRandomProduct() {
  const res = await fetch("/api/products/random");
  return res.json() as Promise<{ code: string; name: string }>;
}

export const Route = createFileRoute("/mobile/scan")({
  component: ScanPage,
});

function ScanPage() {
  const nav = useNavigate();
  const [pendingLocation, setPendingLocation] = useState<{ code: string; label: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [randomCode, setRandomCode] = useState<{ code: string; name: string } | null>(null);

  const loadRandom = useCallback(async () => {
    const p = await fetchRandomProduct();
    setRandomCode(p);
  }, []);

  const handleScan = async (result: { code: string; ok: boolean; label: string }) => {
    const loc = parseLocation(result.code);
    if (loc) {
      const exists = await checkLocationExists(loc.raw);
      if (!exists) { setPendingLocation({ code: loc.raw, label: loc.label }); return; }
      toast.success(loc.label, { description: `Lokalizacja: ${loc.raw}` });
      return;
    }
    if (result.ok) {
      toast.success(result.label, { description: "Przekierowuję do karty produktu…" });
      setTimeout(() => nav({ to: "/mobile/product/$code", params: { code: result.code } }), 400);
    } else {
      toast.error(result.label);
    }
  };

  const handleCameraScan = (code: string) => {
    handleScan({ code, ok: true, label: `Zeskanowano: ${code}` });
  };

  const handleLocationPick = (code: string) => {
    handleScan({ code, ok: true, label: `Lokalizacja: ${code}`, kind: "ok" } as any);
  };

  const handleAddLocation = async () => {
    if (!pendingLocation) return;
    setAdding(true);
    try {
      const r = await addLocation(pendingLocation.code);
      if (r.ok) toast.success("Lokalizacja dodana", { description: pendingLocation.label });
      else toast.error(r.error || "Błąd");
    } catch (e: any) { toast.error(e.message); }
    finally { setAdding(false); setPendingLocation(null); }
  };

  // Reload random on mount
  if (!randomCode) loadRandom();

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <h1 className="text-lg font-bold">Skaner</h1>

      <CameraScanner onScan={handleCameraScan} inline />

      <LocationPicker onSelect={handleLocationPick} />

      {/* New location dialog */}
      {pendingLocation && (
        <div className="rounded-lg border-2 border-warning bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-warning shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Nowa lokalizacja</div>
              <div className="text-xs text-muted-foreground mt-1">Ta lokalizacja nie istnieje jeszcze w systemie.</div>
              <div className="mt-2 font-mono text-sm font-bold">{pendingLocation.code}</div>
              <div className="text-xs text-muted-foreground">{pendingLocation.label}</div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleAddLocation} disabled={adding} className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50">
                  <Plus className="h-3.5 w-3.5" />{adding ? "Dodawanie…" : "Dodaj lokalizację"}
                </button>
                <button onClick={() => setPendingLocation(null)} className="touch-target inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-xs"><X className="h-3.5 w-3.5" />Anuluj</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 border-t" />
        <span className="text-xs text-muted-foreground">lub wpisz ręcznie</span>
        <div className="flex-1 border-t" />
      </div>

      <ScanPanel
        hint="Wpisz kod EAN lub lokalizację ręcznie"
        onScan={handleScan}
        customActions={[
          { label: randomCode ? `${randomCode.name}` : "Losuj towar…", code: randomCode?.code || "", kind: "ok", variant: "primary" },
          { label: "Inny losowy", code: "", kind: "ok" },
        ]}
      />

      {/* Random reload */}
      <button
        onClick={loadRandom}
        className="flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent touch-target"
      >
        <Shuffle className="h-4 w-4" />
        Wylosuj inny towar
      </button>
    </div>
  );
}
