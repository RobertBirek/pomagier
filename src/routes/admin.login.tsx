import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { login as apiLogin } from "@/lib/api";
import { PinPad } from "@/components/pomagier/scan";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Shield, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/login")({ component: AdminLogin });

function AdminLogin() {
  const nav = useNavigate();
  const auth = useAuth();
  const [subiektId, setSubiektId] = useState("");

  const submit = async (pin: string) => {
    const selectedId = Number(subiektId);
    if (!Number.isInteger(selectedId) || selectedId <= 0) return;
    try {
      const result = await apiLogin(selectedId, pin);
      if (result.user.role !== "admin") {
        toast.error("Brak uprawnień administratora");
        return;
      }
      auth.login(result.user, `Administrator ${selectedId}`, "");
      toast.success("Zalogowano administratora");
      nav({ to: "/admin/dashboard" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Błąd logowania");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
            P
          </div>
          <h1 className="text-lg font-bold">PomagierGT</h1>
          <p className="text-xs text-muted-foreground">Panel administracyjny</p>
        </div>

        <div className="space-y-3 rounded-lg border bg-card p-3">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Identyfikator administratora Subiekt GT
          </label>
          <input
            className="w-full rounded-md border px-3 py-2"
            inputMode="numeric"
            value={subiektId}
            onChange={(e) => setSubiektId(e.target.value.replace(/\D/g, ""))}
          />
          <p className="text-xs text-muted-foreground">
            PIN zostanie zweryfikowany dopiero po wysłaniu formularza.
          </p>
          <PinPad onSubmit={submit} />
        </div>

        <Link
          to="/mobile/login"
          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Panel operatora
        </Link>
      </div>
    </div>
  );
}
