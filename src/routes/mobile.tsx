import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { MobileShell } from "@/components/pomagier/MobileShell";

export const Route = createFileRoute("/mobile")({
  component: MobileLayout,
});

function MobileLayout() {
  return (
    <AuthProvider>
      <MobileShell />
    </AuthProvider>
  );
}
