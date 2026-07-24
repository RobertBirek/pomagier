import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/warehouses")({
  component: Page,
});

function Page() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Warehouses</h1>
      <p className="text-sm text-muted-foreground mt-2">Moduł w przygotowaniu</p>
    </div>
  );
}
