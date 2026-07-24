import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/terminals")({
  component: AdminTerminals,
});

function AdminTerminals() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Terminale</h1>
        <p className="text-sm text-muted-foreground">Zarządzanie terminalami magazynowymi</p>
      </div>

      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        <p>Terminale będą widoczne po pierwszym zalogowaniu z urządzenia.</p>
        <p className="mt-1">Dane przechowywane w Postgres (tabela `sessions`).</p>
      </div>
    </div>
  );
}
