import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/alerts")({
  component: Page,
});

function Page() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Alerts</h1>
      <p className="text-sm text-muted-foreground mt-2">Moduł w przygotowaniu</p>
    </div>
  );
}
