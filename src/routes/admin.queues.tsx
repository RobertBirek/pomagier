import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/queues")({
  component: AdminQueues,
});

function AdminQueues() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Kolejki</h1>
        <p className="text-sm text-muted-foreground">Synchronizacja operacji z Subiekt GT</p>
      </div>

      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        <p>System kolejek zostanie wdrożony przy pierwszym module zapisującym dane do Subiekta (Sfera GT).</p>
        <p className="mt-1">Na tym etapie wszystkie operacje są read-only.</p>
      </div>
    </div>
  );
}
