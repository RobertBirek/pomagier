import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShellAdmin } from "@/components/pomagier/AppShellAdmin";
import { AuthProvider } from "@/lib/auth";
import { useAutoLogout } from "@/lib/use-auto-logout";

function AdminWithLogout() {
  useAutoLogout(30);
  return <AppShellAdmin />;
}

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AuthProvider>
      <AdminWithLogout />
    </AuthProvider>
  );
}
