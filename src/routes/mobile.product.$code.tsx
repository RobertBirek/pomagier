import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  StatusBadge,
  SectionTitle,
  ErrorState,
  LoadingRow,
} from "@/components/pomagier/primitives";
import {
  Package,
  MapPin,
  Barcode,
  Scale,
  AlertTriangle,
  Box,
  Truck,
  Clock,
  Hash,
  Shield,
  Layers,
  ArrowRightLeft,
} from "lucide-react";

interface ProductLocation {
  code: string;
  aisle: number;
  rack: number;
  shelf: number;
}

interface ProductStock {
  st_MagId: number;
  mag_Nazwa: string;
  mag_Symbol: string;
  st_Stan: number;
  st_StanRez: number;
  st_StanMin: number;
  st_StanMax: number;
}

interface ProductMovement {
  id: string;
  fromCode: string;
  toCode: string;
  createdAt: string;
}

async function fetchProduct(code: string) {
  // Najpierw znajdź produkt po kodzie (EAN lub symbol)
  const scanRes = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!scanRes.ok) throw new Error("Product not found");
  const scanData = await scanRes.json();
  if (!scanData.found || !scanData.products[0]) throw new Error("Product not found");

  // Pobierz pełne dane
  const id = scanData.products[0].productId;
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) throw new Error("Details failed");
  return res.json();
}

export const Route = createFileRoute("/mobile/product/$code")({ component: ProductPage });

function ProductPage() {
  const { code } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["product", code],
    queryFn: () => fetchProduct(code),
    retry: 1,
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-md p-4">
        <LoadingRow />
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-md p-4">
        <ErrorState
          title="Nie znaleziono produktu"
          description={`Kod "${code}" nie został odnaleziony`}
        />
      </div>
    );

  const stocks = data.stocks || [];
  const locations = data.locations || [];
  const movements = data.movements || [];

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">{data.name}</h1>
      </div>

      {/* Basic info */}
      <div className="rounded-lg border bg-card p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-semibold">{data.symbol}</span>
        </div>
        {data.barcode && (
          <div className="flex items-center gap-2">
            <Barcode className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{data.barcode}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <span>j.m.: {data.unit}</span>
        </div>
        {data.pkwiu && <div className="text-xs text-muted-foreground">PKWiU: {data.pkwiu}</div>}
        {data.vatRate && <div className="text-xs text-muted-foreground">VAT: {data.vatRate}</div>}
        {data.groupName && (
          <div className="text-xs text-muted-foreground">Grupa: {data.groupName}</div>
        )}
        <div className="flex flex-wrap gap-1">
          {data.blocked && <StatusBadge tone="danger">Zablokowany</StatusBadge>}
          {data.openPrice && <StatusBadge tone="warning">Cena otwarta</StatusBadge>}
          {data.depositSystem && <StatusBadge tone="info">System kaucyjny</StatusBadge>}
        </div>
      </div>

      {/* Locations */}
      {locations.length > 0 && (
        <div>
          <SectionTitle title={`Lokalizacje (${locations.length})`} />
          <div className="mt-2 space-y-1">
            {locations.map((l: ProductLocation) => (
              <div
                key={l.code}
                className="flex items-center gap-2 rounded border bg-muted/20 px-3 py-2 text-xs font-mono"
              >
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {l.code}
                <span className="text-muted-foreground">
                  · alejka {l.aisle}, regał {l.rack}, półka {l.shelf}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock */}
      {stocks.length > 0 && (
        <div>
          <SectionTitle title="Stany magazynowe" />
          <div className="mt-2 space-y-2">
            {stocks.map((s: ProductStock) => (
              <div key={s.st_MagId} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{s.mag_Nazwa}</span>
                    <StatusBadge tone="muted">{s.mag_Symbol}</StatusBadge>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{s.st_Stan}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.st_StanRez > 0 ? `${s.st_StanRez} zarezerwowane` : "Dostępne"}
                    </div>
                  </div>
                </div>
                {(s.st_StanMin > 0 || s.st_StanMax > 0) && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Min: {s.st_StanMin} · Max: {s.st_StanMax}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {data.description && (
        <div>
          <SectionTitle title="Opis" />
          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
            {data.description}
          </p>
        </div>
      )}

      {/* Additional info */}
      <div className="rounded-lg border bg-card p-4 text-sm space-y-1">
        <SectionTitle title="Dodatkowe informacje" />
        {data.productCode && (
          <div className="flex items-center gap-2 text-xs">
            <Box className="h-3.5 w-3.5 text-muted-foreground" />
            Kod: {data.productCode}
          </div>
        )}
        {data.producerCode && (
          <div className="flex items-center gap-2 text-xs">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            Dostawca: {data.producerCode}
          </div>
        )}
        {data.weight > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Scale className="h-3.5 w-3.5 text-muted-foreground" />
            Waga: {data.weight} kg
          </div>
        )}
        {data.netWeight > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Scale className="h-3.5 w-3.5 text-muted-foreground" />
            Waga netto: {data.netWeight} kg
          </div>
        )}
        {data.expiryDays > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Ważność: {data.expiryDays} dni
          </div>
        )}
      </div>

      {/* Movement history */}
      {movements.length > 0 && (
        <div>
          <SectionTitle title="Ostatnie ruchy" />
          <div className="mt-2 space-y-1">
            {movements.slice(0, 5).map((m: ProductMovement) => (
              <div key={m.id} className="flex items-center gap-2 text-xs border-b py-1">
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                {m.fromCode && m.toCode ? (
                  <span className="font-mono">
                    {m.fromCode} → <span className="font-semibold">{m.toCode}</span>
                  </span>
                ) : m.toCode ? (
                  <span className="font-mono text-success">→ {m.toCode}</span>
                ) : (
                  <span className="font-mono text-destructive">← {m.fromCode}</span>
                )}
                <span className="text-muted-foreground ml-auto">
                  {new Date(m.createdAt).toLocaleDateString("pl-PL")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
