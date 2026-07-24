import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/pomagier/MobileShell";
import { DemoProvider } from "@/lib/demo-state";

export const Route = createFileRoute("/mobile")({
  component: MobileLayout,
});

function MobileLayout() {
  return (
    <DemoProvider>
      <MobileShell />
    </DemoProvider>
  );
}
