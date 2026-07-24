import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getUsers } from "@/lib/api";
import { KpiCard, StatusBadge, SectionTitle, EmptyState, ErrorState, LoadingRow } from "@/components/pomagier/primitives";
import { Users, Shield, Key, UserX } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    refetchInterval: 30_000,
  });

  const activeUsers = users?.filter((u) => u.active).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Użytkownicy</h1>
        <p className="text-sm text-muted-foreground">Operatorzy z Subiekt GT + PIN-y z PomagierGT</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Wszyscy" value={String(users?.length ?? 0)} icon={<Users className="h-4 w-4" />} tone="primary" />
        <KpiCard label="Aktywni" value={String(activeUsers)} icon={<Shield className="h-4 w-4" />} tone="success" />
        <KpiCard label="Z PIN-em" value={String(users?.filter((u) => u.hasPin).length ?? 0)} icon={<Key className="h-4 w-4" />} tone="info" />
      </div>

      {isLoading && <LoadingRow />}
      {error && <ErrorState title="Błąd" description="Nie udało się pobrać użytkowników" retry={() => window.location.reload()} />}

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
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.subiektId} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{u.subiektId}</td>
                  <td className="px-4 py-2">{u.firstName || <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="px-4 py-2 font-semibold">{u.lastName}</td>
                  <td className="px-4 py-2">
                    <StatusBadge tone={u.role === "admin" ? "warning" : "info"}>{u.role}</StatusBadge>
                  </td>
                  <td className="px-4 py-2">
                    {u.active ? <StatusBadge tone="success">Aktywny</StatusBadge> : <StatusBadge tone="muted">Nieaktywny</StatusBadge>}
                  </td>
                  <td className="px-4 py-2">
                    {u.hasPin ? <StatusBadge tone="success">Skonfigurowany</StatusBadge> : <StatusBadge tone="danger">Brak PIN</StatusBadge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {users && users.length === 0 && <EmptyState title="Brak użytkowników" description="Subiekt GT nie zwrócił danych lub Postgres nie jest dostępny" />}
    </div>
  );
}
