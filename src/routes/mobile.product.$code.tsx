import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge, ErrorState, LoadingRow } from "@/components/pomagier/primitives";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Package,
  MapPin,
  Barcode,
  ChevronRight,
  ArrowLeft,
  MoreHorizontal,
  Search,
  ArrowRightLeft,
  ArrowDownToLine,
  Layers,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProductLocation {
  code: string;
  area: string;
  aisle: number;
  rack: number;
  shelf: number;
  quantity: number;
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
  symbol: string | null;
  name: string | null;
  fromCode: string | null;
  toCode: string | null;
  quantity: number;
  operator: string | null;
  createdAt: string;
}

interface ProductData {
  productId: number;
  symbol: string;
  name: string;
  barcode: string;
  unit: string;
  description?: string;
  blocked?: boolean;
  openPrice?: boolean;
  depositSystem?: boolean;
  stocks: ProductStock[];
  locations: ProductLocation[];
  movements: ProductMovement[];
}

async function fetchProduct(code: string): Promise<ProductData> {
  const res = await fetch(`/api/products/code/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

function StockBar({
  available,
  reserved,
  max,
}: {
  available: number;
  reserved: number;
  max: number;
}) {
  const total = available + reserved;
  const maxVal = Math.max(total, max, 1);
  const availPct = Math.min(100, (available / maxVal) * 100);
  const rezPct = Math.min(100 - availPct, (reserved / maxVal) * 100);
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${availPct}%` }} />
        <div className="h-full bg-amber-400 transition-all" style={{ width: `${rezPct}%` }} />
      </div>
      <span className="text-xs tabular-nums shrink-0">
        <span className="font-semibold">{available}</span>
        {reserved > 0 && <span className="text-muted-foreground"> · {reserved} rez.</span>}
      </span>
    </div>
  );
}

export const Route = createFileRoute("/mobile/product/$code")({ component: ProductPage });

function ProductPage() {
  const { code } = Route.useParams();
  const nav = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["product", code],
    queryFn: () => fetchProduct(code),
    retry: 1,
  });

  const [showTools, setShowTools] = useState(false);

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
  const totalAvailable = stocks.reduce((s, st) => s + st.st_Stan - st.st_StanRez, 0);
  const totalReserved = stocks.reduce((s, st) => s + st.st_StanRez, 0);

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
          <Package className="h-5 w-5 text-primary shrink-0" />
          <h1 className="text-lg font-bold truncate">{data.name}</h1>
        </div>
        <button
          onClick={() => setShowTools(true)}
          className="touch-target rounded p-2 hover:bg-accent shrink-0"
          aria-label="Akcje"
        >
          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Subtitle */}
      <div className="text-sm space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Barcode className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono font-bold">{data.barcode || data.symbol}</span>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {data.symbol} · {data.unit}
        </div>
      </div>

      {/* Status badges */}
      {(data.blocked || data.openPrice || data.depositSystem) && (
        <div className="flex flex-wrap gap-1">
          {data.blocked && <StatusBadge tone="danger">Zablokowany</StatusBadge>}
          {data.openPrice && <StatusBadge tone="warning">Cena otwarta</StatusBadge>}
          {data.depositSystem && <StatusBadge tone="info">System kaucyjny</StatusBadge>}
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="stocks">
        <TabsList className="w-full">
          <TabsTrigger value="stocks" className="flex-1">
            Stany ({stocks.length})
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex-1">
            Lokalizacje ({locations.length})
          </TabsTrigger>
          <TabsTrigger value="movements" className="flex-1">
            Ruchy ({movements.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Stany ── */}
        <TabsContent value="stocks" className="space-y-2">
          {stocks.length > 0 ? (
            <>
              {/* Totals */}
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Łącznie</span>
                  <span className="font-bold tabular-nums">{totalAvailable + totalReserved}</span>
                </div>
                <StockBar
                  available={totalAvailable}
                  reserved={totalReserved}
                  max={Math.max(...stocks.map((s) => s.st_StanMax || 0), 1)}
                />
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>
                    Dostępne: <b className="text-emerald-600">{totalAvailable}</b>
                  </span>
                  {totalReserved > 0 && (
                    <span>
                      Zarezerwowane: <b className="text-amber-600">{totalReserved}</b>
                    </span>
                  )}
                </div>
              </div>

              {stocks.map((s) => {
                const avail = s.st_Stan - s.st_StanRez;
                return (
                  <div key={s.st_MagId} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{s.mag_Nazwa}</span>
                      <StatusBadge tone="muted">{s.mag_Symbol}</StatusBadge>
                    </div>
                    <StockBar
                      available={avail}
                      reserved={s.st_StanRez}
                      max={s.st_StanMax || s.st_Stan}
                    />
                    {(s.st_StanMin > 0 || s.st_StanMax > 0) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Min: {s.st_StanMin} · Max: {s.st_StanMax}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="mx-auto h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">Brak stanów magazynowych</p>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Lokalizacje ── */}
        <TabsContent value="locations" className="space-y-2">
          {locations.length > 0 ? (
            locations.map((l) => (
              <button
                key={l.code}
                onClick={() => nav({ to: "/mobile/location/$code", params: { code: l.code } })}
                className="w-full rounded-lg border bg-card p-3 flex items-center gap-3 text-left hover:bg-accent active:scale-[0.98] transition-all touch-target"
              >
                <MapPin className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-bold text-sm">{l.code}</div>
                  <div className="text-xs text-muted-foreground">{l.quantity} szt.</div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="mx-auto h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm">Brak przypisanych lokalizacji</p>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Ruchy ── */}
        <TabsContent value="movements" className="space-y-2">
          {movements.length > 0 ? (
            movements.map((m) => (
              <div key={m.id} className="rounded-lg border bg-card p-3 space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  {m.fromCode && m.toCode ? (
                    <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <ArrowDownToLine
                      className={`h-3.5 w-3.5 shrink-0 ${m.toCode ? "text-success" : "text-destructive rotate-180"}`}
                    />
                  )}
                  <span className="font-mono font-semibold">{m.symbol || "—"}</span>
                  <span className="text-muted-foreground truncate">{m.name}</span>
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
                onClick={() => {
                  setShowTools(false);
                  toast.info(`ID produktu: ${data.productId}`, { description: data.symbol });
                }}
                className="w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold hover:bg-accent transition-colors touch-target"
              >
                <Search className="h-5 w-5 text-blue-500" />
                Pokaż ID w Subiekcie
              </button>
              <button
                onClick={() => {
                  setShowTools(false);
                  nav({ to: "/mobile/locations", search: { code: data.barcode || data.symbol } });
                }}
                className="w-full flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold hover:bg-accent transition-colors touch-target"
              >
                <ArrowRightLeft className="h-5 w-5 text-amber-500" />
                Przenieś do lokalizacji
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
