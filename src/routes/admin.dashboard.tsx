import { createFileRoute } from "@tanstack/react-router";
import { useDemo } from "@/lib/demo-state";
import {
  KpiCard,
  ConnectionStatus,
  StatusBadge,
  SectionTitle,
} from "@/components/pomagier/primitives";
import { Package, Terminal, ClipboardList, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { offline, setOffline, pendingSync } = useDemo();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Przegląd systemu PomagierGT</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Towary w ERP"
          value="44"
          icon={<Package className="h-4 w-4" />}
          tone="primary"
        />
        <KpiCard
          label="Terminale"
          value="3"
          hint="2 online"
          icon={<Terminal className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Zadania aktywne"
          value="8"
          icon={<ClipboardList className="h-4 w-4" />}
          tone="warning"
        />
        <KpiCard
          label="Oczekujące sync"
          value={String(pendingSync)}
          icon={<RefreshCw className="h-4 w-4" />}
          tone={pendingSync > 0 ? "warning" : "muted"}
        />
      </div>

      <div>
        <SectionTitle title="Status systemu" />
        <div className="mt-2 flex gap-3">
          <ConnectionStatus online={!offline} label="MSSQL" />
          <StatusBadge tone="info">API: OK</StatusBadge>
        </div>
      </div>
    </div>
  );
}
