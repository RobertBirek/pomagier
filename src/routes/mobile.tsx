import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { use401Redirect } from "@/lib/use-401-redirect";
import { ScanBasketProvider } from "@/lib/scan-basket";
import { MobileShell } from "@/components/pomagier/MobileShell";

export const Route = createFileRoute("/mobile")({
  component: MobileLayout,
});

function MobileLayout() {
  return (
    <AuthProvider>
      <MobileLayoutInner />
    </AuthProvider>
  );
}

function MobileLayoutInner() {
  use401Redirect("/mobile/login");
  return (
    <ScanBasketProvider>
      <MobileShell />
    </ScanBasketProvider>
  );
}
