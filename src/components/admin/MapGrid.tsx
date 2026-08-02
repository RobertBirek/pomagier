import { MapPin, Package, Layers } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { KpiCard, LoadingRow, ErrorState } from "@/components/pomagier/primitives";
import { useMapData } from "@/hooks/use-map-data";
import { MapControls } from "./MapControls";
import { MapRack } from "./MapRack";
import { MapProductCard } from "./MapProductCard";
import { VerifyModal } from "./VerifyModal";
import { MapSidebar } from "./MapSidebar";
import { SyncStatusBadge } from "./SyncStatusBadge";

type MapData = ReturnType<typeof useMapData>;

interface MapGridProps {
  data: MapData;
}

export function MapGrid({ data }: MapGridProps) {
  const qc = useQueryClient();
  const {
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
    totalLocs,
    totalProducts,
    totalQty,
    verifyMut,
    fixMut,
    subiektMut,
    clearMut,
    batchMut,
  } = data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mapa magazynu</h1>
        <p className="text-sm text-muted-foreground">
          Wizualizacja lokalizacji z ilościami towarów
        </p>
      </div>

      <MapControls
        areas={areas}
        area={area}
        search={search}
        verifyPending={verifyMut.isPending}
        onAreaChange={setArea}
        onSearchChange={setSearch}
        onVerify={() => verifyMut.mutate()}
      />

      <SyncStatusBadge
        onSyncComplete={() => {
          qc.invalidateQueries({ queryKey: ["grid"] });
          qc.invalidateQueries({ queryKey: ["empty-locs"] });
        }}
      />

      {isLoading && <LoadingRow />}

      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          {areaData ? (
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-background px-2 py-1 text-left font-medium text-muted-foreground border-b">
                      Alejka \ Półka
                    </th>
                    {Array.from({ length: areaData.maxShelf }, (_, i) => i + 1).map((s) => (
                      <th
                        key={s}
                        className="px-2 py-1 text-center font-medium text-muted-foreground border-b min-w-[2.5rem]"
                      >
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: areaData.maxAisle }, (_, i) => i + 1).map((aisle) => (
                    <MapRack
                      key={aisle}
                      area={area}
                      aisle={aisle}
                      maxShelf={areaData.maxShelf}
                      grid={areaData.grid}
                      maxQty={maxQty}
                      searchLower={searchLower}
                      onCellClick={handleCellClick}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !isLoading && (
              <ErrorState title="Brak danych" description="Uruchom import i synchronizację" />
            )
          )}
        </div>

        <MapSidebar emptyLocs={emptyLocs} area={area} />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard
          label="Obszarów"
          value={String(areas.length)}
          icon={<Layers className="h-4 w-4" />}
          tone="primary"
        />
        <KpiCard
          label="Lokalizacji"
          value={String(totalLocs)}
          icon={<MapPin className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Towarów"
          value={String(totalProducts)}
          icon={<Package className="h-4 w-4" />}
          tone="info"
        />
        <KpiCard
          label="Sztuk"
          value={String(totalQty)}
          icon={<Package className="h-4 w-4" />}
          tone="warning"
        />
      </div>

      <MapProductCard
        cellDetail={cellDetail}
        loading={loadingCell}
        onClose={() => setCellDetail(null)}
      />

      {verifyResult && (
        <VerifyModal
          verifyResult={verifyResult}
          selectedProducts={selectedProducts}
          fixPending={fixMut.isPending}
          subiektPending={subiektMut.isPending}
          clearPending={clearMut.isPending}
          batchPending={batchMut.isPending}
          onClose={() => setVerifyResult(null)}
          onToggleProduct={(id) => {
            setSelectedProducts((prev) => {
              const s = new Set(prev);
              if (s.has(id)) s.delete(id);
              else s.add(id);
              return s;
            });
          }}
          onSelectAll={() =>
            setSelectedProducts(new Set(verifyResult.details.map((d) => d.productId)))
          }
          onDeselectAll={() => setSelectedProducts(new Set())}
          onBatchFix={(ids, dir) => batchMut.mutate({ ids, dir })}
          onFixAll={() => fixMut.mutate()}
          onSubiektAll={() => subiektMut.mutate()}
          onClearAll={() => {
            if (confirm("Wyzerować pole lokalizacji w Subiekt GT?")) clearMut.mutate();
          }}
        />
      )}
    </div>
  );
}
