/** Format: "A 1-2-3-4" (Code 128) — spacja po obszarze obowiązkowa */

export interface LocationParsed {
  raw: string;
  area: string; // A, B, C...
  aisle: number; // Alejka
  rack: number; // Regał/Rząd
  shelf: number; // Półka
  spot: number; // Miejsce na półce (zawsze 1)
  label: string; // "Obszar A, Alejka 3, Regał 2, Półka 5"
}

const LOCATION_RE = /^([A-Z])\s*(\d+)-(\d+)-(\d+)-(\d+)$/;

/** Normalize and parse location code. Accepts both "A 1-2-3-4" and "A1-2-3-4" (auto-inserts space). */
export function parseLocation(raw: string): LocationParsed | null {
  const trimmed = raw.trim();
  const match = trimmed.match(LOCATION_RE);
  if (!match) return null;

  const [, area, aisle, rack, shelf, spot] = match;
  const normalized = `${area} ${aisle}-${rack}-${shelf}-${spot}`;
  return {
    raw: normalized,
    area,
    aisle: parseInt(aisle),
    rack: parseInt(rack),
    shelf: parseInt(shelf),
    spot: parseInt(spot),
    label: `Obszar ${area}, Alejka ${aisle}, Regał ${rack}, Półka ${shelf}`,
  };
}

/** Sort locations: area ASC, aisle ASC, rack ASC, shelf ASC */
export function sortLocations(locs: LocationParsed[]): LocationParsed[] {
  return [...locs].sort((a, b) => {
    if (a.area !== b.area) return a.area.localeCompare(b.area);
    if (a.aisle !== b.aisle) return a.aisle - b.aisle;
    if (a.rack !== b.rack) return a.rack - b.rack;
    return a.shelf - b.shelf;
  });
}

/** Group locations by area */
export function groupByArea(locs: LocationParsed[]): Map<string, LocationParsed[]> {
  const map = new Map<string, LocationParsed[]>();
  for (const loc of sortLocations(locs)) {
    const list = map.get(loc.area) || [];
    list.push(loc);
    map.set(loc.area, list);
  }
  return map;
}
