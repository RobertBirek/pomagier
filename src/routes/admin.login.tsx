import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getUsers, login as apiLogin } from "@/lib/api";
import { PinPad } from "@/components/pomagier/scan";
import { useState } from "react";
import { toast } from "sonner";
import { User, Shield, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/login")({ component: AdminLogin });

function AdminLogin() {
  const nav = useNavigate();
  const auth = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const admins = users.filter((u) => u.active && u.role === "admin");
  const selected = admins.find((u) => u.subiektId === selectedId);

  const submit = async (pin: string) => {
    if (!selectedId) return;
    try {
      const result = await apiLogin(selectedId, pin);
      if (result.user.role !== "admin") {
        toast.error("Brak uprawnień administratora");
        return;
      }
      const name = `${selected?.firstName || ""} ${selected?.lastName || ""}`.trim();
      auth.login(result.token, result.user, name, "");
      toast.success(`Witaj, ${name.split(" ")[0]}!`);
      nav({ to: "/admin/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Błąd logowania");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">P</div>
          <h1 className="text-lg font-bold">PomagierGT</h1>
          <p className="text-xs text-muted-foreground">Panel administracyjny</p>
        </div>

        {admins.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            <Shield className="mx-auto h-8 w-8 opacity-30 mb-2" />
            <p>Brak administratorów</p>
            <p className="text-xs mt-1">Skonfiguruj role w bazie danych</p>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Wybierz administratora</div>
              <div className="space-y-1">
                {admins.map((u) => (
                  <button
                    key={u.subiektId}
                    onClick={() => setSelectedId(u.subiektId)}
                    className={`touch-target flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${selectedId === u.subiektId ? "border-primary bg-primary/10" : "bg-card hover:bg-accent"}`}
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-muted-foreground">Administrator</div>
                    </div>
                    {selectedId === u.subiektId && <Shield className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <div className="rounded-lg border bg-card p-3">
                <div className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  PIN dla: <b className="text-foreground">{selected.firstName || selected.lastName}</b>
                </div>
                <PinPad onSubmit={submit} />
              </div>
            )}
          </>
        )}

        <Link to="/mobile/login" className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />Panel operatora
        </Link>
      </div>
    </div>
  );
}
