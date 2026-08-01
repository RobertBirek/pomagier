import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers } from "@/lib/api";
import {
  KpiCard,
  StatusBadge,
  SectionTitle,
  EmptyState,
  ErrorState,
  LoadingRow,
} from "@/components/pomagier/primitives";
import { PinPad } from "@/components/pomagier/scan";
import { Users, Shield, Key, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function setPin(subiektUzId: number, pin: string) {
  const res = await fetch(`/api/users/${subiektUzId}/pin`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

async function setRole(subiektUzId: number, role: string) {
  const res = await fetch(`/api/users/${subiektUzId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const {
    data: users,
    isLoading,
    error,
  } = useQuery({ queryKey: ["users"], queryFn: getUsers, refetchInterval: 30_000 });
  const [pinUser, setPinUser] = useState<{ subiektId: number; name: string } | null>(null);

  const setPinMut = useMutation({
    mutationFn: ({ id, pin }: { id: number; pin: string }) => setPin(id, pin),
    onSuccess: () => {
      toast.success("PIN zaktualizowany");
      setPinUser(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setRoleMut = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => setRole(id, role),
    onSuccess: () => {
      toast.success("Rola zmieniona");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeUsers = users?.filter((u) => u.active).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Użytkownicy</h1>
        <p className="text-sm text-muted-foreground">
          Operatorzy z Subiekt GT + PIN-y z PomagierGT. Przypisanie magazynu odbywa się globalnie w{" "}
          <a href="/admin/erp" className="underline">
            Subiekt GT → Obsługiwane magazyny
          </a>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Wszyscy"
          value={String(users?.length ?? 0)}
          icon={<Users className="h-4 w-4" />}
          tone="primary"
        />
        <KpiCard
          label="Aktywni"
          value={String(activeUsers)}
          icon={<Shield className="h-4 w-4" />}
          tone="success"
        />
        <KpiCard
          label="Z PIN-em"
          value={String(users?.filter((u) => u.hasPin).length ?? 0)}
          icon={<Key className="h-4 w-4" />}
          tone="info"
        />
      </div>

      {isLoading && <LoadingRow />}
      {error && (
        <ErrorState
          title="Błąd"
          description="Nie udało się pobrać użytkowników"
          retry={() => window.location.reload()}
        />
      )}

      {/* PIN change modal */}
      {pinUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPinUser(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">Zmień PIN</h2>
                <p className="text-sm text-muted-foreground">
                  {pinUser.name} (ID: {pinUser.subiektId})
                </p>
              </div>
              <button onClick={() => setPinUser(null)} className="rounded p-1 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <PinPad onSubmit={(pin) => setPinMut.mutate({ id: pinUser.subiektId, pin })} />
            {setPinMut.isPending && (
              <p className="text-center text-xs text-muted-foreground mt-2">Zapisywanie…</p>
            )}
          </div>
        </div>
      )}

      {users && users.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">ID Subiekt</th>
                <th className="px-4 py-2 text-left font-medium">Imię</th>
                <th className="px-4 py-2 text-left font-medium">Nazwisko</th>
                <th className="px-4 py-2 text-left font-medium">Rola</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">PIN</th>
                <th className="px-4 py-2 text-left font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.subiektId} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{u.subiektId}</td>
                  <td className="px-4 py-2">
                    {u.firstName || <span className="text-muted-foreground italic">—</span>}
                  </td>
                  <td className="px-4 py-2 font-semibold">{u.lastName}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => setRoleMut.mutate({ id: u.subiektId, role: e.target.value })}
                      className="rounded border bg-background px-2 py-1 text-xs"
                    >
                      <option value="admin">Admin</option>
                      <option value="operator">Operator</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    {u.active ? (
                      <StatusBadge tone="success">Aktywny</StatusBadge>
                    ) : (
                      <StatusBadge tone="muted">Nieaktywny</StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {u.hasPin ? (
                      <StatusBadge tone="success">Ustawiony</StatusBadge>
                    ) : (
                      <StatusBadge tone="danger">Brak</StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() =>
                        setPinUser({
                          subiektId: u.subiektId,
                          name: `${u.firstName} ${u.lastName}`.trim() || `ID ${u.subiektId}`,
                        })
                      }
                      className="touch-target rounded border px-2 py-1 text-xs hover:bg-accent"
                      title={u.hasPin ? "Zmień PIN" : "Ustaw PIN"}
                    >
                      <Key className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {users && users.length === 0 && (
        <EmptyState
          title="Brak użytkowników"
          description="Subiekt GT nie zwrócił danych lub Postgres nie jest dostępny"
        />
      )}
    </div>
  );
}
