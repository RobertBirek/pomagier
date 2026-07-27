import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PinPad } from "@/components/pomagier/scan";
import { toast } from "sonner";
import { Key, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/pin")({ component: PinChange });

function PinChange() {
  const auth = useAuth();
  const nav = useNavigate();

  if (!auth.user) {
    nav({ to: "/mobile/login" });
    return null;
  }

  const handleChange = async (newPin: string) => {
    try {
      const res = await fetch(`/api/users/${auth.user!.subiektUzId}/pin`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: newPin }),
      });
      if (res.ok) {
        toast.success("PIN zmieniony");
        setTimeout(() => nav({ to: "/mobile/dashboard" }), 500);
      } else {
        const err = await res.json();
        toast.error(err.error || "Błąd");
      }
    } catch {
      toast.error("Błąd połączenia");
    }
  };

  return (
    <div className="mx-auto max-w-md p-4">
      <Link to="/mobile/dashboard" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3 w-3" />Powrót
      </Link>

      <div className="text-center mb-4">
        <Key className="mx-auto h-8 w-8 text-primary mb-2" />
        <h1 className="text-lg font-bold">Zmień PIN</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {auth.operatorName}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Wprowadź nowy PIN (4-8 cyfr)
        </div>
        <PinPad onSubmit={handleChange} maxLength={8} />
      </div>
    </div>
  );
}
