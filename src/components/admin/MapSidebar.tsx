import { Box } from "lucide-react";

interface MapSidebarProps {
  emptyLocs:
    | { code: string; area: string; aisle: number; rack: number; shelf: number; label: string }[]
    | undefined;
  area: string;
}

export function MapSidebar({ emptyLocs, area }: MapSidebarProps) {
  return (
    <div className="hidden lg:block w-64 shrink-0">
      <div className="rounded-lg border bg-card p-3 sticky top-4">
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
          <Box className="h-4 w-4 text-muted-foreground" />
          Wolne lokalizacje
        </div>
        {Array.isArray(emptyLocs) && emptyLocs.filter((l) => l.area === area).length > 0 ? (
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {emptyLocs
              .filter((l) => l.area === area)
              .map((l) => (
                <div key={l.code} className="text-xs font-mono text-muted-foreground py-0.5">
                  {l.code}
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Brak wolnych w obszarze {area}</p>
        )}
        {Array.isArray(emptyLocs) && (
          <p className="text-xs text-muted-foreground mt-2">Wszystkie: {emptyLocs.length}</p>
        )}
      </div>
    </div>
  );
}
