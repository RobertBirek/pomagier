import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScanPanel } from "@/components/pomagier/scan";
import { parseLocation } from "@/lib/locations";
import { toast } from "sonner";
import { useState } from "react";
import { MapPin, Plus, X } from "lucide-react";

async function checkLocationExists(code: string) {
  const res = await fetch(`/api/products-by-location?location=${encodeURIComponent(code)}`);
  const products = await res.json();
  return products.length > 0;
}

async function addLocation(code: string) {
  const res = await fetch("/api/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return res.json();
}

export const Route = createFileRoute("/mobile/scan")({
  component: ScanPage,
});

function ScanPage() {
  const nav = useNavigate();
  const [pendingLocation, setPendingLocation] = useState<{ code: string; label: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const handleScan = async (result: { code: string; ok: boolean; label: string }) => {
    // Sprawdź czy to kod lokalizacji
    const loc = parseLocation(result.code);
    if (loc) {
      const exists = await checkLocationExists(loc.raw);
      if (!exists) {
        // Nowa lokalizacja — pokaż dialog potwierdzenia
        setPendingLocation({ code: loc.raw, label: loc.label });
        return;
      }
      toast.success(loc.label, { description: `Lokalizacja: ${loc.raw}` });
      return;
    }

    // Standardowe skanowanie produktu
    if (result.ok) {
      toast.success(result.label, { description: "Przekierowuję do karty produktu…" });
      setTimeout(() => {
        nav({ to: "/mobile/product/$code", params: { code: result.code } });
      }, 400);
    } else {
      toast.error(result.label);
    }
  };

  const handleAddLocation = async () => {
    if (!pendingLocation) return;
    setAdding(true);
    try {
      const result = await addLocation(pendingLocation.code);
      if (result.ok) {
        toast.success("Lokalizacja dodana", { description: pendingLocation.label });
      } else {
        toast.error(result.error || "Błąd");
      }
    } catch (e: any) {
      toast.error(e.message || "Błąd");
    } finally {
      setAdding(false);
      setPendingLocation(null);
    }
  };

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-lg font-bold">Skaner</h1>
      <p className="mb-3 text-xs text-muted-foreground">
        Zeskanuj kod EAN produktu lub Code 128 lokalizacji
      </p>

      {/* Dialog: nowa lokalizacja */}
      {pendingLocation && (
        <div className="mb-4 rounded-lg border-2 border-warning bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-warning shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Nowa lokalizacja</div>
              <div className="text-xs text-muted-foreground mt-1">
                Ta lokalizacja nie istnieje jeszcze w systemie.
              </div>
              <div className="mt-2 font-mono text-sm font-bold">{pendingLocation.code}</div>
              <div className="text-xs text-muted-foreground">{pendingLocation.label}</div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleAddLocation}
                  disabled={adding}
                  className="touch-target inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {adding ? "Dodawanie…" : "Dodaj lokalizację"}
                </button>
                <button
                  onClick={() => setPendingLocation(null)}
                  className="touch-target inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ScanPanel hint="Zeskanuj EAN lub lokalizację" onScan={handleScan} />
    </div>
  );
}
