import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionTitle, ErrorState, LoadingRow } from "@/components/pomagier/primitives";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MapPin,
  Package,
  Barcode,
  ChevronRight,
  ArrowLeft,
  MoreHorizontal,
  Search,
  PackagePlus,
  ArrowRightLeft,
  ArrowDownToLine,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface LocationProduct {
  productId: number;
  symbol: string;
  name: string;
  barcode: string;
  unit: string;
  quantity: number;
}

interface Movement {
  id: string;
  symbol: string | null;
  name: string | null;
  fromCode: string | null;
  toCode: string | null;
  quantity: number;
  operator: string | null;
  createdAt: string;
}

interface LocationData {
  code: string;
  area: string;
  aisle: number;
  rack: number;
  shelf: number;
  productCount: number;
  totalQuantity: number;
  products: LocationProduct[];
  movements: Movement[];
}

async function fetchLocation(code: string): Promise<LocationData> {
  const res = await fetch(`/api/locations/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Nie znaleziono");
  return res.json();
}

async function verifyLocation(code: string) {
  const res = await fetch(`/api/locations/verify?location=${encodeURIComponent(code)}`);
  return res.json() as Promise<{
    comparison: { location: string; assigned: number; inSubiekt: number } | null;
  }>;
}

export const Route = createFileRoute("/mobile/location/$code")({ component: LocationCard });

function LocationCard() {
  const { code } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["location", code],
    queryFn: () => fetchLocation(code),
    retry: 1,
  });

  const [showTools, setShowTools] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    assigned: number;
    inSubiekt: number;
  } | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await verifyLocation(code);
      if (result.comparison) {
        setVerifyResult(result.comparison);
        const diff = result.comparison.assigned - result.comparison.inSubiekt;
        if (diff === 0) {
          toast.success("Stan zgodny — Postgres i Subiekt mają tyle samo");
        } else {
          toast.warning(
            `Rozbieżność: ${Math.abs(diff)} szt. ${diff > 0 ? "więcej" : "mniej"} w Postgres niż w Subiekcie`,
          );
        }
      } else {
        toast.error("Nie udało się zweryfikować");
      }
    } catch {
      toast.error("Błąd weryfikacji");
    } finally {
      setVerifying(false);
      setShowTools(false);
    }
  };

  const handleAssign = () => {
    setShowTools(false);
    nav({ to: "/mobile/locations" });
  };

  if (isLoading)
    return (
      <div className="mx-auto max-w-md p-4">
        <LoadingRow />
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-md p-4">
        <ErrorState title="Nie znaleziono" description={`Lokalizacja "${code}" nie istnieje`} />
      </div>
    );

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else nav({ to: "/mobile/dashboard" });
            }}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground touch-target rounded p-1 -ml-1 shrink-0"
            aria-label="Powrót"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <MapPin className="h-5 w-5 text-blue-500 shrink-0" />
          <h1 className="text-lg font-bold font-mono truncate">{data.code}</h1>
        </div>

        {/* Tools button */}
        <button
          onClick={() => setShowTools(true)}
          className="touch-target rounded p-2 hover:bg-accent shrink-0"
          aria-label="Akcje"
        >
          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Subtitle */}
      <div className="text-sm text-muted-foreground">
        {data.productCount > 0
          ? `${data.productCount} ${data.productCount === 1 ? "produkt" : data.productCount < 5 ? "produkty" : "produktów"} · ${data.totalQuantity} szt.`
          : "Brak produktów"}
      </div>

      {/* Verify result banner */}
      {verifyResult && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            verifyResult.assigned === verifyResult.inSubiekt
              ? "border-success/40 bg-success/5 text-success"
              : "border-warning/40 bg-warning/5 text-warning-foreground"
          }`}
        >
          <span className="font-semibold">Weryfikacja:</span> Postgres: {verifyResult.assigned} ·
          Subiekt: {verifyResult.inSubiekt}
          {verifyResult.assigned === verifyResult.inSubiekt
            ? " — stan zgodny ✅"
            : ` — różnica ${verifyResult.assigned - verifyResult.inSubiekt}`}
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="products">
        <TabsList className="w-full">
          <TabsTrigger value="products" className="flex-1">
            Produkty ({data.products.length})
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex-1">
            Ruchy ({data.movements.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Produkty ── */}
        <TabsContent value="products" className="space-y-2">
          {data.products.length > 0 ? (
            data.products.map((p) => (
              <button
                key={p.productId}
                onClick={() => {
                  nav({
                    to: "/mobile/product/$code",
                    params: { code: p.barcode || p.symbol },
                  });
                }}
                className="w-full rounded-lg border bg-card p-3 flex items-center gap-3 text-left hover:bg-accent active:scale-[0.98] transition-all touch-target"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <Package className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Barcode className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-sm font-bold truncate">
                        {p.barcode || p.symbol}
                      </span>
                    </div>
                    <div className="text-sm truncate">{p.name}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="font-mono">{p.symbol}</span>
                      <span>·</span>
                      <span>
                        {p.quantity} {p.unit}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">Brak produktów</p>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Ruchy ── */}
        <TabsContent value="movements" className="space-y-2">
          {data.movements.length > 0 ? (
            data.movements.map((m) => (
              <div key={m.id} className="rounded-lg border bg-card p-3 space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  {m.fromCode && m.toCode ? (
                    <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  ) : m.toCode ? (
                    <ArrowDownToLine className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : (
                    <ArrowDownToLine className="h-3.5 w-3.5 text-destructive shrink-0 rotate-180" />
                  )}
                  <span className="font-mono font-semibold">{m.symbol || "—"}</span>
                  <span className="text-muted-foreground">{m.name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {m.fromCode && m.toCode ? (
                    <span className="font-mono">
                      {m.fromCode} → {m.toCode}
                    </span>
                  ) : m.toCode ? (
                    <span className="font-mono text-success">Przypisano do {m.toCode}</span>
                  ) : m.fromCode ? (
                    <span className="font-mono text-destructive">Usunięto z {m.fromCode}</span>
                  ) : null}
                  <span className="ml-auto">
                    ×{m.quantity} · {new Date(m.createdAt).toLocaleDateString("pl-PL")}
                  </span>
                </div>
                {m.operator && <div className="text-muted-foreground/70">{m.operator}</div>}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowRightLeft className="mx-auto h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">Brak historii ruchów</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Tools Modal ── */}
      {showTools && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowTools(false)}
        >
          <div
            className="mx-4 w-full max-w-xs rounded-xl bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold">Akcje</span>
              <button
                onClick={() => setShowTools(false)}
                className="touch-target rounded p-1 hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold hover:bg-accent transition-colors touch-target disabled:opacity-50"
              >
                <Search className="h-5 w-5 text-blue-500" />
                <span className="flex-1">Zweryfikuj stan</span>
                {verifying && <span className="text-xs text-muted-foreground">⏳</span>}
              </button>

              <button
                onClick={handleAssign}
                className="w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold hover:bg-accent transition-colors touch-target"
              >
                <PackagePlus className="h-5 w-5 text-emerald-500" />
                Przypisz towary
              </button>
            </div>

            <button
              onClick={() => setShowTools(false)}
              className="mt-3 w-full touch-target rounded-md border px-4 py-2.5 text-sm"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
