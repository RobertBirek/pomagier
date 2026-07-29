import type { CellData } from "@/routes/admin.map";
import { MapShelf } from "./MapShelf";

interface MapRackProps {
  area: string;
  aisle: number;
  maxShelf: number;
  grid: { [aisle: number]: { [shelf: number]: CellData } };
  maxQty: number;
  searchLower: string;
  onCellClick: (code: string) => void;
}

export function MapRack({
  area,
  aisle,
  maxShelf,
  grid,
  maxQty,
  searchLower,
  onCellClick,
}: MapRackProps) {
  const aisleGrid = grid[aisle];
  return (
    <tr>
      <td className="sticky left-0 bg-background px-2 py-1 font-semibold text-muted-foreground border-r">
        {aisle}
      </td>
      {Array.from({ length: maxShelf }, (_, j) => j + 1).map((shelf) => {
        const cell = aisleGrid?.[shelf] ?? null;
        const highlight = !!(
          cell &&
          cell.productCount > 0 &&
          searchLower &&
          cell.code.toLowerCase().includes(searchLower)
        );
        return (
          <MapShelf
            key={shelf}
            cell={cell}
            area={area}
            aisle={aisle}
            shelf={shelf}
            maxQty={maxQty}
            searchHighlight={highlight}
            onClick={onCellClick}
          />
        );
      })}
    </tr>
  );
}
