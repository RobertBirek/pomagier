import { createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";

// Check if hostname is an IP address
function isIpAddress(hostname: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === "localhost";
}

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="text-muted-foreground mt-2">Strona nie została znaleziona</p>
      </div>
    </div>
  ),
});

function RootErrorComponent({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "Nieoczekiwany błąd aplikacji";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h1 className="text-lg font-semibold">Aplikacja napotkała błąd</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <button
          className="touch-target mt-5 rounded-md bg-primary px-4 py-2 text-primary-foreground"
          onClick={() => window.location.reload()}
        >
          Odśwież aplikację
        </button>
      </div>
    </div>
  );
}

function RootComponent() {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const showIpBanner = !bannerDismissed && isIpAddress(hostname);

  return (
    <>
      {showIpBanner && (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-warning/15 border-b border-warning/30 px-4 py-2 text-sm safe-top">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <span className="text-xs">
              Używasz adresu IP. Dla pełnej funkcjonalności (PWA, kamera) otwórz{" "}
              <code className="font-mono font-bold">https://pomagier.local</code>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/setup"
              className="text-xs font-medium underline hover:no-underline whitespace-nowrap"
            >
              Jak skonfigurować
            </Link>
            <button
              onClick={() => setBannerDismissed(true)}
              className="touch-target rounded p-1 hover:bg-warning/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <Outlet />
      <Toaster position="top-center" richColors />
    </>
  );
}
