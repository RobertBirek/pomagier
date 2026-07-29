import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { getUsers, getWarehouses, login as apiLogin } from "@/lib/api";
import { PinPad } from "@/components/pomagier/scan";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { User, Shield } from "lucide-react";

export const Route = createFileRoute("/mobile/login")({
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const auth = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [warehouse, setWarehouse] = useState("");

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: getWarehouses });

  // Set default warehouse when data loads
  const whSymbols = useMemo(() => warehouses.map((w) => w.symbol).join(","), [warehouses]);

  useEffect(() => {
    if (warehouses.length > 0 && !warehouse) {
      setWarehouse(warehouses.find((w) => w.isMain)?.symbol || warehouses[0]?.symbol || "");
    }
  }, [whSymbols, warehouse, warehouses]);

  const userMap = useMemo(() => new Map(users.map((u) => [u.subiektId, u])), [users]);
  const selected = selectedId != null ? userMap.get(selectedId) : null;

  const submit = async (pin: string) => {
    if (!selectedId) return;
    try {
      const result = await apiLogin(selectedId, pin);
      const name = `${selected?.firstName || ""} ${selected?.lastName || ""}`.trim();
      auth.login(result.token, result.user, name, warehouse);
      toast.success(`Witaj, ${name}!`);
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
          Wybierz operatora
        </div>
        <div className="grid grid-cols-2 gap-2">
          {users
            .filter((u) => u.active)
            .map((u) => (
              <button
                key={u.subiektId}
                onClick={() => setSelectedId(u.subiektId)}
                className={`touch-target rounded-lg border p-2 text-left text-xs transition ${
                  selectedId === u.subiektId
                    ? "border-primary bg-primary/10"
                    : "bg-card hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <User className="h-3.5 w-3.5" />
                  {[u.firstName, u.lastName].filter(Boolean).join(" ") || `ID ${u.subiektId}`}
                </div>
                <div className="mt-0.5 text-muted-foreground">{u.role}</div>
                {!u.hasPin && <div className="mt-0.5 text-warning">Brak PIN (skonfiguruj)</div>}
              </button>
            ))}
          {users.length === 0 && (
            <p className="text-muted-foreground col-span-2 text-xs">
              Brak użytkowników (Subiekt niedostępny)
            </p>
          )}
        </div>
      </div>

      {warehouses.length > 0 && (
        <div className="mb-3">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Magazyn
          </label>
          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {warehouses.map((w) => (
              <option key={w.symbol} value={w.symbol}>
                {w.symbol} — {w.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selected && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
        >
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-center">PIN</DialogTitle>
              <DialogDescription className="text-center">
                {[selected.firstName, selected.lastName].filter(Boolean).join(" ") ||
                  `ID ${selected.subiektId}`}
              </DialogDescription>
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
