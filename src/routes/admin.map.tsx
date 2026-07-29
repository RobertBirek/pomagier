import { createFileRoute } from "@tanstack/react-router";
import { LoadingRow } from "@/components/pomagier/primitives";
import { useMapData } from "@/hooks/use-map-data";
import { MapGrid } from "@/components/admin/MapGrid";

export interface CellData {
  code: string;
  shelf: number;
  productCount: number;
  totalQuantity: number;
}
export interface GridData {
  [area: string]: {
    maxAisle: number;
    maxShelf: number;
    grid: { [aisle: number]: { [shelf: number]: CellData } };
  };
}
export interface CellProduct {
  id: number;
  symbol: string;
  name: string;
  barcode?: string;
  unit: string;
}
export interface VerifyDetail {
  productId: number;
  postgres: string[];
  subiekt: string[];
}
export interface VerifyResult {
  totalProducts: number;
  synced: number;
  mismatches: number;
  details: VerifyDetail[];
}
export interface ImportData {
  imported: number;
}
export interface SyncData {
  inserted: number;
}
export interface FixData {
  fixed: number;
}
export interface ClearData {
  rowsAffected: number;
}

export const Route = createFileRoute("/admin/map")({ component: AdminMap });

function AdminMap() {
  const data = useMapData();
  if (data.isLoading) return <LoadingRow />;
  return <MapGrid data={data} />;
}
