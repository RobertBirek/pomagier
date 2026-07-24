import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getStats } from "@/lib/api";

export const Route = createFileRoute("/admin/stats")({
  component: AdminStats,
});

function AdminStats() {
  const { data } = useQuery({ queryKey: ["stats"], queryFn: getStats, refetchInterval: 10_000 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Statystyki</h1>
        <p className="text-sm text-muted-foreground">Dane z Subiekt GT (odświeżane co 10s)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Towary", value: data?.products, hint: "tw__Towar" },
          { label: "Magazyny", value: data?.warehouses, hint: "sl_Magazyn" },
          { label: "Użytkownicy", value: data?.users, hint: "pd_Uzytkownik" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border bg-card p-6 text-center">
            <div className="text-4xl font-bold">{item.value ?? "—"}</div>
            <div className="text-sm font-medium">{item.label}</div>
            <div className="text-xs text-muted-foreground font-mono">{item.hint}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-2">Źródło danych</h2>
        <div className="text-xs font-mono space-y-1 text-muted-foreground">
          <div>SELECT COUNT(*) FROM tw__Towar → {data?.products ?? "?"}</div>
          <div>SELECT COUNT(*) FROM sl_Magazyn → {data?.warehouses ?? "?"}</div>
          <div>SELECT COUNT(*) FROM pd_Uzytkownik WHERE uz_Status = 1 → {data?.users ?? "?"}</div>
        </div>
      </div>
    </div>
  );
}
