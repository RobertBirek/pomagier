import { ShieldCheck, Search } from "lucide-react";

interface MapControlsProps {
  areas: string[];
  area: string;
  search: string;
  verifyPending: boolean;
  onAreaChange: (a: string) => void;
  onSearchChange: (s: string) => void;
  onVerify: () => void;
}

export function MapControls({
  areas,
  area,
  search,
  verifyPending,
  onAreaChange,
  onSearchChange,
  onVerify,
}: MapControlsProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onVerify}
          disabled={verifyPending}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs hover:bg-accent disabled:opacity-50"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Weryfikuj
        </button>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Szukaj towaru..."
            className="w-48 rounded-md border bg-background py-1.5 pl-8 pr-3 text-xs"
          />
        </div>
      </div>
      <div className="flex gap-1 border-b">
        {areas.map((a) => (
          <button
            key={a}
            onClick={() => onAreaChange(a)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${area === a ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Obszar {a}
          </button>
        ))}
      </div>
    </>
  );
}
