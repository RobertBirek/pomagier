import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/logs")({
  component: AdminLogs,
});

function AdminLogs() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Logi</h1>
        <p className="text-sm text-muted-foreground">Audyt operacji magazynowych</p>
      </div>

      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        <p>Logi audytowe będą zapisywane w Postgres (tabela <code className="font-mono">audit_log</code>) przy każdej operacji skanowania i logowania.</p>
        <p className="mt-1">Status: tabela gotowa, zapisywanie w trakcie implementacji.</p>
      </div>
    </div>
  );
}
