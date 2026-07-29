import type { CellData } from "@/routes/admin.map";
import { heatColor } from "@/hooks/use-map-data";

interface MapShelfProps {
  cell: CellData | null;
  area: string;
  aisle: number;
  shelf: number;
  maxQty: number;
  searchHighlight: boolean;
  onClick: (code: string) => void;
}

export function MapShelf({
  cell,
  area,
  aisle,
  shelf,
  maxQty,
  searchHighlight,
  onClick,
}: MapShelfProps) {
  const empty = !cell || cell.productCount === 0;
  return (
    <td className="p-0.5">
      <button
        onClick={() => cell && onClick(cell.code)}
        disabled={empty}
        title={
          cell
            ? `${cell.code} — ${cell.totalQuantity} szt.`
            : `${area} ${aisle}-?-${shelf}-1 (pusta)`
        }
        className={`w-full rounded py-1.5 text-center font-mono font-semibold transition-colors touch-target ${empty ? "bg-muted/30 text-muted-foreground/30 cursor-default" : heatColor(cell!.totalQuantity, maxQty)} ${searchHighlight ? "ring-2 ring-primary ring-offset-1" : ""}`}
      >
        {cell?.totalQuantity || ""}
      </button>
    </td>
  );
}
