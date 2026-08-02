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

const LOCATION_RE = /^([A-Z])\s*(\d+)-(\d+)-(\d+)-(\d+)$/i;

/** Subiekt GT `tw_Pole1` is varchar(50). When joining multiple location codes
 *  with "," this can overflow for 4+ codes of length 12-13. */
export const SUBIEKT_FIELD_MAX_LENGTH = 50;

/** Normalize and parse location code. Accepts both "A 1-2-3-4" and "A1-2-3-4" (auto-inserts space). */
export function parseLocation(raw: string): LocationParsed | null {
  const trimmed = raw.trim();
  const match = trimmed.match(LOCATION_RE);
  if (!match) return null;

  const [, area, aisle, rack, shelf, spot] = match;
  const upper = area.toUpperCase();
  const normalized = `${upper} ${aisle}-${rack}-${shelf}-${spot}`;
  return {
    raw: normalized,
    area: upper,
    aisle: parseInt(aisle),
    rack: parseInt(rack),
    shelf: parseInt(shelf),
    spot: parseInt(spot),
    label: `Obszar ${upper}, Alejka ${aisle}, Regał ${rack}, Półka ${shelf}`,
  };
}

/** Detect malformed location codes (covers all malformations: missing letter+digit prefix,
 *  wrong segment count, non-numeric segments, etc.). Empty string is NOT malformed —
 *  it represents "absent" (e.g. product has no locations). */
export function isMalformedCode(code: string): boolean {
  const trimmed = code.trim();
  if (trimmed === "") return false;
  if (!/^[a-zA-Z]\s*\d/.test(trimmed)) return true;
  return parseLocation(trimmed) === null;
}

/** Build a Subiekt-safe value by joining codes with ",". Throws when the result
 *  would overflow Subiekt's varchar(50) field (MSSQL error 22001). */
export function safeSubiektValue(codes: string[]): string {
  const joined = codes.join(",");
  if (joined.length > SUBIEKT_FIELD_MAX_LENGTH) {
    const err = new Error(
      `Lokalizacje nie mieszczą się w polu Subiekta (max ${SUBIEKT_FIELD_MAX_LENGTH} znaków), obecne kody: ${JSON.stringify(codes)}`,
    );
    (err as Error & { code?: string }).code = "SUBIEKT_FIELD_OVERFLOW";
    throw err;
  }
  return joined;
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
