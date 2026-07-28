import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  SectionTitle,
  LoadingRow,
  EmptyState,
  StatusBadge,
} from "@/components/pomagier/primitives";
import { Smartphone, Clock, Wifi } from "lucide-react";

interface TerminalInfo {
  id: string;
  userId: string;
  loginTime: string;
  expiresAt: string;
}

export const Route = createFileRoute("/admin/terminals")({ component: AdminTerminals });

function AdminTerminals() {
  const { data: terminals, isLoading } = useQuery({
    queryKey: ["terminals"],
    queryFn: async () => {
      const r = await fetch("/api/terminals");
      return r.json() as Promise<TerminalInfo[]>;
    },
    refetchInterval: 15000,
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const r = await fetch("/api/users");
      return r.json() as Promise<
        { subiektId: number; firstName: string; lastName: string; role: string }[]
      >;
    },
  });

  const getUserName = (t: { userName?: string; userId: string }) => {
    if (t.userName) return t.userName;
    return t.userId.slice(0, 8) + "...";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Terminale</h1>
        <p className="text-sm text-muted-foreground">Aktywne sesje użytkowników</p>
      </div>
      {isLoading && <LoadingRow />}
      {(terminals?.length ?? 0) > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {terminals!.map((t) => (
            <div key={t.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <StatusBadge tone="success">
                    <Wifi className="mr-1 inline h-3 w-3" />
                    Online
                  </StatusBadge>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{getUserName(t)}</span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(t.loginTime).toLocaleString("pl-PL")}
                </div>
                <div>Wygasa: {new Date(t.expiresAt).toLocaleTimeString("pl-PL")}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isLoading && (
          <EmptyState
            icon={<Smartphone className="h-8 w-8" />}
            title="Brak aktywnych sesji"
            description="Żaden użytkownik nie jest zalogowany"
          />
        )
      )}
    </div>
  );
}
