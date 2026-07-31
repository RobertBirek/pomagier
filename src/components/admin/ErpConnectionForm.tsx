import { SectionTitle } from "@/components/pomagier/primitives";
import { Save } from "lucide-react";

interface ErpConnectionFormProps {
  form: { host: string; port: number; database: string; user: string; password: string };
  saving: boolean;
  onChange: (form: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }) => void;
  onSubmit: () => void;
}

export function ErpConnectionForm({ form, saving, onChange, onSubmit }: ErpConnectionFormProps) {
  return (
    <div className="rounded-lg border bg-card p-4 max-w-2xl">
      <SectionTitle
        title="Konfiguracja połączenia"
        description="Zmień parametry MSSQL i zapisz w bazie"
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium uppercase text-muted-foreground">Host</label>
          <input
            type="text"
            value={form.host}
            onChange={(e) => onChange({ ...form, host: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder="serwer\instancja"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase text-muted-foreground">Port</label>
          <input
            type="number"
            value={form.port}
            onChange={(e) => onChange({ ...form, port: parseInt(e.target.value) || 1433 })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase text-muted-foreground">Baza danych</label>
          <input
            type="text"
            value={form.database}
            onChange={(e) => onChange({ ...form, database: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder="pomagier"
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase text-muted-foreground">Użytkownik</label>
          <input
            type="text"
            value={form.user}
            onChange={(e) => onChange({ ...form, user: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder="sa"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium uppercase text-muted-foreground">Hasło</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => onChange({ ...form, password: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder="Pozostaw puste aby nie zmieniać"
          />
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={onSubmit}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Zapisuję…" : "Zapisz"}
        </button>
      </div>
    </div>
  );
}
