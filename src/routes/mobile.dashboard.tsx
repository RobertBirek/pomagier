import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { ScanHeader } from "@/components/pomagier/ScanHeader";
import { toast } from "sonner";
import { Scan, ClipboardList, Package, Truck, MapPin, RefreshCw, Key } from "lucide-react";

const tiles = [
  { to: "/mobile/scan", label: "Skanuj", icon: Scan, color: "bg-blue-500", desc: "Skaner kodów" },
  {
    to: "/mobile/picking",
    label: "Kompletacja",
    icon: ClipboardList,
    color: "bg-emerald-500",
    desc: "Zbieranie zamówień",
  },
  {
    to: "/mobile/inventory",
    label: "Inwentaryzacja",
    icon: Package,
    color: "bg-amber-500",
    desc: "Spis z natury",
  },
  {
    to: "/mobile/receiving",
    label: "Dostawy",
    icon: Truck,
    color: "bg-purple-500",
    desc: "Przyjęcie towaru",
  },
  {
    to: "/mobile/locations",
    label: "Lokalizacje",
    icon: MapPin,
    color: "bg-rose-500",
    desc: "Przypisz towary",
  },
  { to: "/mobile/pin", label: "Zmień PIN", icon: Key, color: "bg-slate-500", desc: "Nowy PIN" },
  {
    to: "/mobile/sync",
    label: "Synchronizacja",
    icon: RefreshCw,
    color: "bg-slate-500",
    desc: "Stan synchronizacji",
  },
];

export const Route = createFileRoute("/mobile/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const nav = useNavigate();
  const { operatorName, warehouse } = useAuth();
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    staleTime: 60_000,
  });

  const handleSubmit = useCallback(
    async (code: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/scan-basket", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { type: string; code: string; barcode?: string };

        if (data.type === "product") {
          nav({
            to: "/mobile/product/$code",
            params: { code: data.barcode || data.code },
          });
          return true;
        }
        if (data.type === "location") {
          nav({ to: "/mobile/location/$code", params: { code: data.code } });
          return true;
        }

        toast.error("Nie znaleziono", { description: code });
        return false;
      } catch {
        toast.warning("Offline — spróbuj ponownie", { description: code });
        return false;
      }
    },
    [nav],
  );

  return (
    <div className="mx-auto max-w-md">
      <ScanHeader
        onSubmit={handleSubmit}
        hint="🟢 Szybki skan — kod EAN lub lokalizacji"
        placeholder="Zeskanuj lub wpisz kod..."
      />

      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-lg font-bold">{company?.name || "PomagierGT"}</h1>
          <p className="text-xs text-muted-foreground">
            {operatorName} · {warehouse?.symbol ?? "—"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="touch-target flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm hover:shadow-md active:scale-95 transition-all"
            >
              <div className={`grid h-10 w-10 place-items-center rounded-lg ${t.color} text-white`}>
                <t.icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
