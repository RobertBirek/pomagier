import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/sync")({
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="text-lg font-bold">Sync</h1>
      <p className="text-xs text-muted-foreground mt-2">Moduł w przygotowaniu</p>
    </div>
  );
}
