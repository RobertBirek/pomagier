import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStats, getCompany, healthCheck } from "@/lib/api";
import { KpiCard, StatusBadge, SectionTitle, LoadingRow } from "@/components/pomagier/primitives";
import { Database, Server, Clock, Package, Users, MapPin, Wifi, WifiOff, Save, FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function fetchErpConfig() {
  const res = await fetch("/api/erp-config");
  return res.json() as Promise<{
    host: string; port: number; database: string; user: string; password: string;
  }>;
}

async function saveErpConfig(data: { host: string; port: number; database: string; user: string; password: string }) {
  const res = await fetch("/api/erp-config", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Błąd");
  return res.json();
}

async function testConnection(data: { host: string; port: number; database: string; user: string; password: string }) {
  const res = await fetch("/api/test-connection", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
}

export const Route = createFileRoute("/admin/erp")({
  component: AdminErp,
});

function AdminErp() {
  const qc = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ["stats"], queryFn: getStats, refetchInterval: 15_000 });
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const { data: health, refetch: refetchHealth } = useQuery({ queryKey: ["health"], queryFn: healthCheck, refetchInterval: 10_000 });
  const { data: config } = useQuery({ queryKey: ["erp-config"], queryFn: fetchErpConfig });

  const [form, setForm] = useState({ host: "", port: 1433, database: "", user: "", password: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs?: number; error?: string } | null>(null);

  // Sync form when config loads
  const [synced, setSynced] = useState(false);
  if (config && !synced) {
    setForm({ host: config.host, port: config.port, database: config.database, user: config.user, password: "" });
    setSynced(true);
  }

  const saveMut = useMutation({ mutationFn: saveErpConfig, onSuccess: () => { toast.success("Konfiguracja zapisana"); qc.invalidateQueries({ queryKey: ["health"] }); qc.invalidateQueries({ queryKey: ["stats"] }); qc.invalidateQueries({ queryKey: ["company"] }); refetchHealth(); }, onError: (e: any) => toast.error(e.message) });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testConnection(form);
      setTestResult(r);
      if (r.ok) toast.success(`Połączono (${r.latencyMs} ms)`);
      else toast.error(r.error || "Błąd połączenia");
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message });
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subiekt GT</h1>
        <p className="text-sm text-muted-foreground">Status i konfiguracja połączenia z ERP</p>
      </div>

      {/* Connection status */}
      <div className="rounded-lg border bg-card p-4">
        <SectionTitle title="Status połączenia" />
        <div className="mt-3 flex flex-wrap gap-3">
          {health?.erp?.ok ? (
            <StatusBadge tone="success"><Wifi className="mr-1 h-3 w-3" />Połączono ({health.erp.latencyMs} ms)</StatusBadge>
          ) : (
            <StatusBadge tone="danger"><WifiOff className="mr-1 h-3 w-3" />Rozłączono</StatusBadge>
          )}
          <StatusBadge tone="info"><Clock className="mr-1 h-3 w-3" />{new Date().toLocaleTimeString("pl-PL")}</StatusBadge>
          <button onClick={() => refetchHealth()} className="text-xs underline text-muted-foreground hover:text-foreground">Odśwież</button>
        </div>
      </div>

      {/* Company info */}
      {company && (
        <div className="rounded-lg border bg-card p-4">
          <SectionTitle title="Firma" />
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div><span className="text-muted-foreground">Nazwa:</span> <span className="font-semibold">{company.name || "(bez nazwy)"}</span></div>
            <div><span className="text-muted-foreground">NIP:</span> <span className="font-mono">{company.nip || "—"}</span></div>
            <div><span className="text-muted-foreground">REGON:</span> <span className="font-mono">{company.regon || "—"}</span></div>
          </div>
        </div>
      )}

      {/* Table counts */}
      <div>
        <SectionTitle title="Rekordy w Subiekt GT" />
        {statsLoading && <LoadingRow />}
        {stats && (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <KpiCard label="tw__Towar" value={String(stats.products)} hint="Kartoteki towarowe" icon={<Package className="h-4 w-4" />} tone="primary" />
            <KpiCard label="sl_Magazyn" value={String(stats.warehouses)} hint="Magazyny" icon={<MapPin className="h-4 w-4" />} tone="success" />
            <KpiCard label="pd_Uzytkownik" value={String(stats.users)} hint="Operatorzy" icon={<Users className="h-4 w-4" />} tone="info" />
          </div>
        )}
      </div>

      {/* Connection config form */}
      <div className="rounded-lg border bg-card p-4 max-w-2xl">
        <SectionTitle title="Konfiguracja połączenia" description="Zmień parametry MSSQL i zapisz w bazie" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">Host</label>
            <input type="text" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" placeholder="10.10.254.87\OPTIMA" />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">Port</label>
            <input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 1433 })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">Baza danych</label>
            <input type="text" value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" placeholder="pomagier" />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">Użytkownik</label>
            <input type="text" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" placeholder="sa" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium uppercase text-muted-foreground">Hasło</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" placeholder="Pozostaw puste aby nie zmieniać" />
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`mt-3 rounded-md p-3 text-sm ${testResult.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {testResult.ok
              ? `✓ Połączono pomyślnie (${testResult.latencyMs} ms)`
              : `✗ ${testResult.error || "Błąd połączenia"}`}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={handleTest} disabled={testing || !form.host}
            className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">
            <FlaskConical className="h-4 w-4" />
            {testing ? "Testuję…" : "Testuj połączenie"}
          </button>
          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saveMut.isPending ? "Zapisuję…" : "Zapisz"}
          </button>
        </div>
      </div>
    </div>
  );
}
