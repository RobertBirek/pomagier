import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/backup")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/admin/backup"!</div>;
}
