import { useState, useEffect, useMemo } from "react";
import { MapPin, ChevronRight } from "lucide-react";

interface LocationData {
  raw: string; area: string; aisle: number; rack: number; shelf: number; spot: number; label: string;
}

interface LocationPickerProps {
  onSelect: (code: string) => void;
}

export function LocationPicker({ onSelect }: LocationPickerProps) {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [step, setStep] = useState<"area" | "aisle" | "rack" | "shelf">("area");
  const [selected, setSelected] = useState<{ area?: string; aisle?: number; rack?: number; shelf?: number }>({});

  useEffect(() => {
    fetch("/api/locations").then(r => r.json()).then(setLocations).catch(() => {});
  }, []);

  const areas = useMemo(() => [...new Set(locations.map(l => l.area))].sort(), [locations]);
  const aisles = useMemo(() => [...new Set(locations.filter(l => l.area === selected.area).map(l => l.aisle))].sort((a, b) => a - b), [locations, selected.area]);
  const racks = useMemo(() => [...new Set(locations.filter(l => l.area === selected.area && l.aisle === selected.aisle).map(l => l.rack))].sort((a, b) => a - b), [locations, selected.area, selected.aisle]);
  const shelves = useMemo(() => [...new Set(locations.filter(l => l.area === selected.area && l.aisle === selected.aisle && l.rack === selected.rack).map(l => l.shelf))].sort((a, b) => a - b), [locations, selected.area, selected.aisle, selected.rack]);

  const handleSelect = (value: string | number) => {
    if (step === "area") {
      setSelected({ area: value as string });
      setStep("aisle");
    } else if (step === "aisle") {
      setSelected(s => ({ ...s, aisle: value as number }));
      setStep("rack");
    } else if (step === "rack") {
      setSelected(s => ({ ...s, rack: value as number }));
      setStep("shelf");
    } else if (step === "shelf") {
      const full = { ...selected, shelf: value as number };
      const code = `${full.area} ${full.aisle}-${full.rack}-${full.shelf}-1`;
      onSelect(code);
      setSelected({}); setStep("area");
    }
  };

  const reset = () => { setSelected({}); setStep("area"); };

  const items = step === "area" ? areas : step === "aisle" ? aisles : step === "rack" ? racks : shelves;

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-primary" />
          Wybierz lokalizację
        </div>
        {(selected.area || selected.aisle) && (
          <button onClick={reset} className="text-xs text-muted-foreground underline">Reset</button>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
        <span className={step === "area" ? "font-bold text-foreground" : ""}>
          {selected.area || "Obszar"}
        </span>
        {selected.area && <><ChevronRight className="h-3 w-3" />
        <span className={step === "aisle" ? "font-bold text-foreground" : ""}>
          {selected.aisle || "Alejka"}
        </span></>}
        {selected.aisle && <><ChevronRight className="h-3 w-3" />
        <span className={step === "rack" ? "font-bold text-foreground" : ""}>
          {selected.rack || "Regał"}
        </span></>}
        {selected.rack && <><ChevronRight className="h-3 w-3" />
        <span className={step === "shelf" ? "font-bold text-foreground" : ""}>
          {selected.shelf || "Półka"}
        </span></>}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => handleSelect(item)}
            className="touch-target rounded-lg border bg-background py-3 text-center text-sm font-semibold hover:bg-accent hover:border-primary active:scale-95 transition-all"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
