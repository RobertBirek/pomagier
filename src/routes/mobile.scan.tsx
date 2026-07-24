import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScanPanel } from "@/components/pomagier/scan";
import { toast } from "sonner";

export const Route = createFileRoute("/mobile/scan")({
  component: ScanPage,
});

function ScanPage() {
  const nav = useNavigate();

  const handleScan = (result: { code: string; ok: boolean; label: string }) => {
    if (result.ok) {
      toast.success(result.label, { description: "Przekierowuję do karty produktu…" });
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
      <ScanPanel hint="Zeskanuj lub wpisz kod EAN" onScan={handleScan} />
    </div>
  );
}
