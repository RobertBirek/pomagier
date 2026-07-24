import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, SectionTitle, ErrorState } from "@/components/pomagier/primitives";
import { scanCode } from "@/lib/api";
import { Package, MapPin, Barcode, Scale, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/mobile/product/$code")({
  component: ProductPage,
});

function ProductPage() {
  const { code } = Route.useParams();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["product", code],
    queryFn: () => scanCode(code),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-muted" />
          <div className="h-40 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !data?.found) {
    return (
      <div className="mx-auto max-w-md p-4">
        <h1 className="mb-4 text-lg font-bold">Produkt</h1>
        <ErrorState
          title="Nie znaleziono produktu"
          description={`Kod "${code}" nie został odnaleziony w bazie ERP.`}
          retry={error ? () => refetch() : undefined}
        />
      </div>
    );
  }

  const product = data.products[0];

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">{product.name}</h1>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Barcode className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-mono">{product.barcode || code}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Symbol:</span>
          <span className="text-sm font-semibold">{product.symbol}</span>
        </div>
        {product.description && (
          <p className="text-xs text-muted-foreground">{product.description}</p>
        )}
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">j.m.: {product.unit}</span>
        </div>
      </div>

      {product.stocks.length > 0 && (
        <div>
          <SectionTitle title="Stany magazynowe" />
          <div className="mt-2 space-y-2">
            {product.stocks.map((s) => (
              <div key={s.warehouseId} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-semibold">{s.warehouseName}</div>
                    <div className="text-xs text-muted-foreground">{s.warehouseSymbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{s.quantity}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.reserved > 0 ? (
                      <StatusBadge tone="warning">
                        <AlertTriangle className="h-3 w-3" /> {s.reserved} zarezerwowane
                      </StatusBadge>
                    ) : (
                      <span className="text-success">Dostępne</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
