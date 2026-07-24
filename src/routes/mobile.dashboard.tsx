import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { Scan, ClipboardList, Package, Truck, MapPin, RefreshCw, ListTodo } from "lucide-react";

const tiles = [
  { to: "/mobile/scan", label: "Skanuj", icon: Scan, color: "bg-blue-500", desc: "Skaner kodów" },
  { to: "/mobile/picking", label: "Kompletacja", icon: ClipboardList, color: "bg-emerald-500", desc: "Zbieranie zamówień" },
  { to: "/mobile/inventory", label: "Inwentaryzacja", icon: Package, color: "bg-amber-500", desc: "Spis z natury" },
  { to: "/mobile/receiving", label: "Dostawy", icon: Truck, color: "bg-purple-500", desc: "Przyjęcie towaru" },
  { to: "/mobile/locations", label: "Lokalizacje", icon: MapPin, color: "bg-rose-500", desc: "Gdzie jest towar" },
  { to: "/mobile/my-tasks", label: "Moje zadania", icon: ListTodo, color: "bg-cyan-500", desc: "Lista zadań" },
  { to: "/mobile/sync", label: "Synchronizacja", icon: RefreshCw, color: "bg-slate-500", desc: "Stan synchronizacji" },
];

export const Route = createFileRoute("/mobile/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { operatorName, warehouse } = useAuth();
  const { data: company } = useQuery({
    queryKey: ["company"],
    queryFn: getCompany,
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-4">
        <h1 className="text-lg font-bold">{company?.name || "PomagierGT"}</h1>
        <p className="text-xs text-muted-foreground">{operatorName} · {warehouse}</p>
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
  );
}
