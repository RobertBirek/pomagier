import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShellAdmin } from "@/components/pomagier/AppShellAdmin";
import { DemoProvider } from "@/lib/demo-state";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <DemoProvider>
      <AppShellAdmin />
    </DemoProvider>
  );
}
