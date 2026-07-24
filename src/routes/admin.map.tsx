import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/map")({
  component: Page,
});

function Page() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Map</h1>
      <p className="text-sm text-muted-foreground mt-2">Moduł w przygotowaniu</p>
    </div>
  );
}
