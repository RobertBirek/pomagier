import { createFileRoute } from "@tanstack/react-router";
import { SectionTitle } from "@/components/pomagier/primitives";

export const Route = createFileRoute("/admin/erp")({
  component: ErpConfig,
});

function ErpConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Konfiguracja ERP</h1>
        <p className="text-sm text-muted-foreground">Połączenie z Insert Subiekt GT</p>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4 max-w-2xl">
        <SectionTitle
          title="MSSQL Subiekt GT"
          description="Ustawienia połączenia z bazą danych Subiekta"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">Host</label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="sql01.firma.local"
              defaultValue="sql01.firma.local"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">Port</label>
            <input
              type="number"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="1433"
              defaultValue={1433}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Baza danych
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="Subiekt_GT_FirmaDemo"
              defaultValue="Subiekt_GT_FirmaDemo"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Użytkownik
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="pomagier_svc"
              defaultValue="pomagier_svc"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium uppercase text-muted-foreground">Hasło</label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="••••••••"
              defaultValue="pomagier_svc"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Testuj połączenie
          </button>
          <button className="rounded-md border px-4 py-2 text-sm">Zapisz</button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4 max-w-2xl">
        <SectionTitle
          title="Sfera GT"
          description="Ustawienia komunikacji z Sferą GT (operacje zapisu)"
        />
        <p className="text-sm text-muted-foreground">
          Sfera GT nie jest wymagana w pierwszym MVP (tylko odczyt MSSQL). Konfiguracja zostanie
          dodana w kolejnej iteracji.
        </p>
      </div>
    </div>
  );
}
