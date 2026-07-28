import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  StatusBadge,
  SectionTitle,
  ErrorState,
  LoadingRow,
} from "@/components/pomagier/primitives";
import { MapPin, Package, Barcode, Layers } from "lucide-react";
import { parseLocation } from "@/lib/locations";

async function fetchLocationProducts(code: string) {
  const res = await fetch(`/api/products-by-location?location=${encodeURIComponent(code)}`);
  return res.json() as Promise<
    { id: number; symbol: string; name: string; barcode: string; unit: string }[]
  >;
}

export const Route = createFileRoute("/mobile/location/$code")({ component: LocationCard });

function LocationCard() {
  const { code } = Route.useParams();
  const {
    data: products,
    isLoading,
    error,
  } = useQuery({ queryKey: ["location", code], queryFn: () => fetchLocationProducts(code) });
  const parsed = parseLocation(code);

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">{code}</h1>
      </div>
      {parsed && (
        <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span>
              Obszar {parsed.area}, Alejka {parsed.aisle}, Regał {parsed.rack}, Półka {parsed.shelf}
            </span>
          </div>
        </div>
      )}
      {isLoading && <LoadingRow />}
      {error && <ErrorState title="Błąd" description="Nie udało się pobrać produktów" />}
      {products && products.length > 0 && (
        <div>
          <SectionTitle title={`Produkty (${products.length})`} />
          <div className="mt-2 space-y-2">
            {products.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border bg-card p-3 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold">{p.symbol}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.name}</div>
                  {p.barcode && (
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      <Barcode className="inline h-3 w-3" /> {p.barcode}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0 ml-2">{p.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {products && products.length === 0 && !isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
          <p className="text-sm">Brak produktów</p>
        </div>
      )}
    </div>
  );
}
