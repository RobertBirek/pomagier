import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { login as apiLogin } from "@/lib/api";
import { PinPad } from "@/components/pomagier/scan";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/mobile/login")({
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const auth = useAuth();
  const [subiektId, setSubiektId] = useState("");

  const submit = async (pin: string) => {
    const selectedId = Number(subiektId);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return;
    try {
      const result = await apiLogin(selectedId, pin);
      auth.login(
        result.user,
        `Operator ${selectedId}`,
        result.user.warehouseId ? String(result.user.warehouseId) : "",
      );
      toast.success("Zalogowano operatora");
      nav({ to: "/mobile/dashboard" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Błąd logowania");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center pt-[40px] px-4 pb-4">
      <div className="mb-4 text-center">
        <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
          P
        </div>
        <h1 className="text-lg font-bold">PomagierGT</h1>
        <p className="text-xs text-muted-foreground">Terminal magazynowy</p>
      </div>

      <div className="mb-3">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Identyfikator operatora Subiekt GT
        </div>
        <input
          className="w-full rounded-md border px-3 py-2"
          inputMode="numeric"
          value={subiektId}
          onChange={(e) => setSubiektId(e.target.value.replace(/\D/g, ""))}
        />
      </div>

      {subiektId && (
        <Dialog open>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-center">PIN</DialogTitle>
              <DialogDescription className="text-center">Operator ID {subiektId}</DialogDescription>
            </DialogHeader>
            <PinPad onSubmit={submit} />
          </DialogContent>
        </Dialog>
      )}

      <Link
        to="/admin/login"
        className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2"
      >
        <Shield className="h-3 w-3" />
        Panel administratora
      </Link>
    </div>
  );
}
