import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShellAdmin } from "@/components/pomagier/AppShellAdmin";
import { AuthProvider } from "@/lib/auth";
import { useAutoLogout } from "@/lib/use-auto-logout";

function AdminWithLogout() {
  useAutoLogout(30);
  return <AppShellAdmin />;
}

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin/login") return; // allow login page
    const data = localStorage.getItem("pomagier_auth");
    if (data) {
      const { token, user } = JSON.parse(data);
      if (token && user?.role === "admin") return;
    }
    throw redirect({ to: "/admin/login" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <AuthProvider>
      <AdminWithLogout />
    </AuthProvider>
  );
}
