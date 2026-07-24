import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PinPad } from "@/components/pomagier/scan";
import { useDemo } from "@/lib/demo-state";
import { users, warehouses } from "@/lib/mock-data";
import { useState } from "react";
import { toast } from "sonner";
import { User, Package } from "lucide-react";

export const Route = createFileRoute("/mobile/login")({
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const { setCurrentOperator, setCurrentWarehouse } = useDemo();
  const [selected, setSelected] = useState(users[2]);
  const [warehouse, setWarehouse] = useState(warehouses[0].code);

  const submit = (pin: string) => {
    if (pin !== selected.pin) {
      toast.error("Nieprawidłowy PIN", { description: `Demo PIN: ${selected.pin}` });
      return;
    }
    setCurrentOperator(selected.name);
    setCurrentWarehouse(warehouse);
    toast.success(`Witaj, ${selected.name.split(" ")[0]}!`);
    nav({ to: "/mobile/dashboard" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col p-4">
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
          {users.slice(0, 4).map((u) => (
            <button
              key={u.id}
              onClick={() => setSelected(u)}
              className={`touch-target rounded-lg border p-2 text-left text-xs transition ${
                selected.id === u.id ? "border-primary bg-primary/10" : "bg-card hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <User className="h-3.5 w-3.5" /> {u.name.split(" ")[0]}
              </div>
              <div className="mt-0.5 text-muted-foreground">{u.role}</div>
              <div className="mono mt-0.5 text-muted-foreground">PIN {u.pin}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Magazyn / stanowisko
        </label>
        <select
          value={warehouse}
          onChange={(e) => setWarehouse(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {warehouses.map((w) => (
            <option key={w.code}>{w.code}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          PIN dla: <b className="text-foreground">{selected.name}</b>
        </div>
        <PinPad onSubmit={submit} />
      </div>
    </div>
  );
}
