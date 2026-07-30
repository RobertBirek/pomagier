import { createFileRoute } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { ScanBasketProvider } from "@/lib/scan-basket";
import { MobileShell } from "@/components/pomagier/MobileShell";

export const Route = createFileRoute("/mobile")({
  component: MobileLayout,
});

function MobileLayout() {
  return (
    <AuthProvider>
      <ScanBasketProvider>
        <MobileShell />
      </ScanBasketProvider>
    </AuthProvider>
  );
}
