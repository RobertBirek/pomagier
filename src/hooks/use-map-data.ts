import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import type {
  CellData,
  GridData,
  CellProduct,
  VerifyDetail,
  VerifyResult,
  ImportData,
  SyncData,
  FixData,
  ClearData,
} from "@/routes/admin.map";

export function heatColor(totalQuantity: number, maxQty: number): string {
  if (totalQuantity === 0) return "bg-muted/30 hover:bg-muted/50";
  const ratio = Math.min(totalQuantity / Math.max(maxQty, 1), 1);
  if (ratio < 0.2) return "bg-green-100 hover:bg-green-200 text-green-900";
  if (ratio < 0.4) return "bg-green-200 hover:bg-green-300 text-green-900";
  if (ratio < 0.6) return "bg-yellow-100 hover:bg-yellow-200 text-yellow-900";
  if (ratio < 0.8) return "bg-orange-200 hover:bg-orange-300 text-orange-900";
  return "bg-red-200 hover:bg-red-300 text-red-900";
}

async function fetchGrid() {
  const r = await fetch("/api/locations/grid");
  const data = await r.json();
  return (data && typeof data === "object" && !Array.isArray(data) ? data : {}) as GridData;
}
async function fetchEmpty() {
  const r = await fetch("/api/locations/empty");
  const data = await r.json();
  return (Array.isArray(data) ? data : []) as {
    code: string;
    area: string;
    aisle: number;
    rack: number;
    shelf: number;
    label: string;
  }[];
}
export async function fetchCellProducts(location: string) {
  const r = await fetch(`/api/products-by-location?location=${encodeURIComponent(location)}`);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
async function importLocations() {
  const r = await fetch("/api/locations/import", { method: "POST" });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
async function syncProductLocations() {
  const r = await fetch("/api/locations/sync", { method: "POST" });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
async function verifySync() {
  const r = await fetch("/api/locations/verify-sync");
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
async function fixSync() {
  const r = await fetch("/api/locations/fix-sync", { method: "POST" });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
async function syncFromSubiekt() {
  const r = await fetch("/api/locations/sync", { method: "POST" });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
async function clearField() {
  const r = await fetch("/api/locations/clear-field", { method: "POST" });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
async function batchFix(productIds: number[], direction: string) {
  const r = await fetch("/api/locations/fix-sync-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productIds, direction }),
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export function useMapData() {
  const qc = useQueryClient();
  const { data: grid, isLoading } = useQuery({ queryKey: ["grid"], queryFn: fetchGrid });
  const { data: emptyLocs } = useQuery({ queryKey: ["empty-locs"], queryFn: fetchEmpty });
  const [area, setArea] = useState("A");
  const [search, setSearch] = useState("");
  const [cellDetail, setCellDetail] = useState<{ code: string; products: CellProduct[] } | null>(
    null,
  );
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [loadingCell, setLoadingCell] = useState(false);

  const importMut = useMutation({
    mutationFn: importLocations,
    onSuccess: (d: ImportData) => {
      toast.success(`Import: ${d.imported} lokalizacji`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const syncMut = useMutation({
    mutationFn: syncProductLocations,
    onSuccess: (d: SyncData) => toast.success(`Sync: ${d.inserted} powiązań`),
    onError: (e: Error) => toast.error(e.message),
  });
  const verifyMut = useMutation({
    mutationFn: verifySync,
    onSuccess: (data: VerifyResult) => {
      setVerifyResult(data);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fixMut = useMutation({
    mutationFn: fixSync,
    onSuccess: (data: FixData) => {
      toast.success(`✅ Subiekt zaktualizowany — ${data.fixed} produktów`);
      setVerifyResult(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const subiektMut = useMutation({
    mutationFn: syncFromSubiekt,
    onSuccess: (data: SyncData) => {
      toast.success(`✅ Postgres zaktualizowany — ${data.inserted} powiązań`);
      setVerifyResult(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearMut = useMutation({
    mutationFn: clearField,
    onSuccess: (data: ClearData) => {
      toast.success(`✅ Wyzerowano — ${data.rowsAffected} wierszy`);
      setVerifyResult(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const batchMut = useMutation({
    mutationFn: ({ ids, dir }: { ids: number[]; dir: string }) => batchFix(ids, dir),
    onSuccess: () => {
      toast.success("✅ Wykonano");
      setVerifyResult(null);
      setSelectedProducts(new Set());
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const areaData = grid?.[area];
  const areas = grid ? Object.keys(grid).sort() : [];

  const maxQty = useMemo(() => {
    if (!areaData) return 1;
    let max = 1;
    for (const aisle of Object.values(areaData.grid)) {
      for (const cell of Object.values(aisle)) {
        if (cell.totalQuantity > max) max = cell.totalQuantity;
      }
    }
    return max;
  }, [areaData]);

  const searchLower = search.toLowerCase().trim();

  const handleCellClick = async (code: string) => {
    setLoadingCell(true);
    setCellDetail({ code, products: [] });
    const prods = await fetchCellProducts(code);
    setCellDetail({ code, products: prods });
    setLoadingCell(false);
  };

  const handlePrintLabels = () => {
    if (!areaData) return;
    const codes: string[] = [];
    for (const aisle of Object.values(areaData.grid)) {
      for (const cell of Object.values(aisle)) {
        if (cell.productCount > 0) codes.push(cell.code);
      }
    }
    if (codes.length === 0) {
      toast.error("Brak lokalizacji z towarami");
      return;
    }
    fetch(`/api/locations/export-pdf?codes=${codes.join(",")}`)
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      })
      .catch(() => toast.error("Błąd eksportu"));
  };

  const totalLocs = areaData
    ? Object.values(areaData.grid).reduce((s, a) => s + Object.keys(a).length, 0)
    : 0;
  const totalProducts = areaData
    ? Object.values(areaData.grid).reduce(
        (s, a) => s + Object.values(a).reduce((ss, c) => ss + c.productCount, 0),
        0,
      )
    : 0;
  const totalQty = areaData
    ? Object.values(areaData.grid).reduce(
        (s, a) => s + Object.values(a).reduce((ss, c) => ss + c.totalQuantity, 0),
        0,
      )
    : 0;

  return {
    grid,
    emptyLocs,
    isLoading,
    area,
    setArea,
    search,
    setSearch,
    areaData,
    areas,
    maxQty,
    searchLower,
    cellDetail,
    setCellDetail,
    loadingCell,
    verifyResult,
    setVerifyResult,
    selectedProducts,
    setSelectedProducts,
    handleCellClick,
    handlePrintLabels,
    totalLocs,
    totalProducts,
    totalQty,
    importMut,
    syncMut,
    verifyMut,
    fixMut,
    subiektMut,
    clearMut,
    batchMut,
  };
}
