import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScanPanel } from "@/components/pomagier/scan";
import { useDemo } from "@/lib/demo-state";
import { toast } from "sonner";

export const Route = createFileRoute("/mobile/scan")({
  component: ScanPage,
});

function ScanPage() {
  const nav = useNavigate();
  const { bumpPendingSync } = useDemo();

  const handleScan = (result: { code: string; ok: boolean; label: string }) => {
    bumpPendingSync();

    if (result.ok) {
      toast.success(result.label, {
        description: "Przekierowuję do karty produktu…",
      });
      setTimeout(() => {
        nav({ to: "/mobile/product/$code", params: { code: result.code } });
      }, 400);
    } else {
      toast.error(result.label);
    }
  };

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-lg font-bold">Skaner</h1>
      <p className="mb-3 text-xs text-muted-foreground">Zeskanuj kod EAN lub wpisz ręcznie</p>
      <ScanPanel
        hint="Zeskanuj lub wpisz kod EAN"
        onScan={handleScan}
        customActions={[
          { label: "Olej napędowy", code: "A_OLEJ", kind: "ok" },
          { label: "Gaz ziemny", code: "A_GAZ_ZIEMNY", kind: "ok" },
          { label: "Węgiel", code: "A_WEGIEL", kind: "ok" },
        ]}
      />
    </div>
  );
}
