import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Smartphone, Monitor } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
          P
        </div>
        <h1 className="text-2xl font-bold">PomagierGT</h1>
      </div>
      <p className="text-muted-foreground text-center max-w-md">Wybierz interfejs:</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/mobile"
          className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow touch-target"
        >
          <Smartphone className="h-8 w-8 text-primary" />
          <span className="font-semibold">Klient mobilny</span>
          <span className="text-xs text-muted-foreground">Terminal / skaner</span>
        </Link>
        <Link
          to="/admin"
          className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow touch-target"
        >
          <Monitor className="h-8 w-8 text-primary" />
          <span className="font-semibold">Panel administracyjny</span>
          <span className="text-xs text-muted-foreground">Desktop</span>
        </Link>
      </div>
    </div>
  );
}
