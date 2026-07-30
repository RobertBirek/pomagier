import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SectionTitle, ErrorState, LoadingRow } from "@/components/pomagier/primitives";
import { MapPin, Package, Barcode, ArrowLeft } from "lucide-react";

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

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Link
          to="/mobile/scan"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground touch-target rounded p-1 -ml-1"
          aria-label="Powrót do koszyka"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <MapPin className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold font-mono">{code}</h1>
      </div>
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
