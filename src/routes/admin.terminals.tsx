import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SectionTitle, LoadingRow, EmptyState, StatusBadge } from "@/components/pomagier/primitives";
import { Smartphone, Clock, Wifi } from "lucide-react";

async function fetchTerminals() {
  const r = await fetch("/api/terminals");
  return r.json() as Promise<{ id: string; userName: string; role: string; loginTime: string; expiresAt: string; active: boolean }[]>;
}

export const Route = createFileRoute("/admin/terminals")({ component: AdminTerminals });

function AdminTerminals() {
  const { data: terminals, isLoading } = useQuery({ queryKey: ["terminals"], queryFn: fetchTerminals, refetchInterval: 15000 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Terminale</h1>
        <p className="text-sm text-muted-foreground">Aktywne sesje użytkowników</p>
      </div>

      {isLoading && <LoadingRow />}

      {terminals && terminals.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {terminals.map((t) => (
            <div key={t.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">{t.userName}</span>
                </div>
                <StatusBadge tone={t.active ? "success" : "muted"}>
                  {t.active ? <Wifi className="mr-1 inline h-3 w-3" /> : <Clock className="mr-1 inline h-3 w-3" />}
                  {t.active ? "Online" : "Wygasła"}
                </StatusBadge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1"><Clock className="h-3 w-3" />Zalogowany: {new Date(t.loginTime).toLocaleTimeString("pl-PL")}</div>
                <div>Wygasa: {new Date(t.expiresAt).toLocaleTimeString("pl-PL")}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isLoading && <EmptyState icon={<Smartphone className="h-8 w-8" />} title="Brak aktywnych sesji" description="Żaden użytkownik nie jest zalogowany" />
      )}
    </div>
  );
}
