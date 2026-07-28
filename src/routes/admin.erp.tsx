import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStats, getCompany, healthCheck } from "@/lib/api";
import { KpiCard, StatusBadge, SectionTitle, LoadingRow } from "@/components/pomagier/primitives";
import {
  Database,
  Server,
  Clock,
  Package,
  Users,
  MapPin,
  Wifi,
  WifiOff,
  Save,
  FlaskConical,
  ArrowRightLeft,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

async function fetchErpConfig() {
  const res = await fetch("/api/erp-config");
  return res.json() as Promise<{
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }>;
}

async function saveErpConfig(data: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}) {
  const res = await fetch("/api/erp-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Błąd");
  return res.json();
}

async function testConnection(data: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}) {
  const res = await fetch("/api/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
}

async function fetchFieldMappings() {
  const res = await fetch("/api/field-mappings");
  return res.json() as Promise<
    { key: string; label: string; subiektField: string; subiektTable: string }[]
  >;
}

async function saveFieldMappings(mappings: { key: string; subiektField: string }[]) {
  const res = await fetch("/api/field-mappings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mappings),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  return res.json();
}

const AVAILABLE_FIELDS = [
  { value: "tw_Pole1", label: "tw_Pole1 (varchar 50)" },
  { value: "tw_Pole2", label: "tw_Pole2 (varchar 50)" },
  { value: "tw_Pole3", label: "tw_Pole3 (varchar 50)" },
  { value: "tw_Pole4", label: "tw_Pole4 (varchar 50)" },
  { value: "tw_Pole5", label: "tw_Pole5 (varchar 50)" },
  { value: "tw_Pole6", label: "tw_Pole6 (varchar 50)" },
  { value: "tw_Pole7", label: "tw_Pole7 (varchar 50)" },
  { value: "tw_Pole8", label: "tw_Pole8 (varchar 50)" },
  { value: "tw_Opis", label: "tw_Opis (opis)" },
  { value: "tw_Uwagi", label: "tw_Uwagi (uwagi)" },
];

export const Route = createFileRoute("/admin/erp")({
  component: AdminErp,
});

function AdminErp() {
  const qc = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    refetchInterval: 15_000,
  });
  const { data: company } = useQuery({ queryKey: ["company"], queryFn: getCompany });
  const { data: health, refetch: refetchHealth } = useQuery({
    queryKey: ["health"],
    queryFn: healthCheck,
    refetchInterval: 10_000,
  });
  const { data: config } = useQuery({ queryKey: ["erp-config"], queryFn: fetchErpConfig });
  const { data: fieldMappings, refetch: refetchMappings } = useQuery({
    queryKey: ["field-mappings"],
    queryFn: fetchFieldMappings,
  });

  const [form, setForm] = useState({ host: "", port: 1433, database: "", user: "", password: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [fieldMap, setFieldMap] = useState<{ key: string; subiektField: string }[]>([]);

  useEffect(() => {
    if (config) {
      setForm({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: "",
      });
    }
  }, [config]);

  useEffect(() => {
    if (fieldMappings) {
      setFieldMap(fieldMappings.map((m) => ({ key: m.key, subiektField: m.subiektField })));
    }
  }, [fieldMappings]);

  const fieldMapByKey = useMemo(() => new Map(fieldMap.map((m) => [m.key, m])), [fieldMap]);

  const saveMut = useMutation({
    mutationFn: saveErpConfig,
    onSuccess: () => {
      toast.success("Konfiguracja zapisana");
      qc.invalidateQueries({ queryKey: ["health"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["company"] });
      refetchHealth();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const saveMappingsMut = useMutation({
    mutationFn: saveFieldMappings,
    onSuccess: () => {
      toast.success("Mapowanie zapisane");
      refetchMappings();
    },
    onError: (e: any) => toast.error(e.message),
  });

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
            <StatusBadge tone="success">
              <Wifi className="mr-1 h-3 w-3" />
              Połączono ({health.erp.latencyMs} ms)
            </StatusBadge>
          ) : (
            <StatusBadge tone="danger">
              <WifiOff className="mr-1 h-3 w-3" />
              Rozłączono
            </StatusBadge>
          )}
          <StatusBadge tone="info">
            <Clock className="mr-1 h-3 w-3" />
            {new Date().toLocaleTimeString("pl-PL")}
          </StatusBadge>
          <button
            onClick={() => refetchHealth()}
            className="text-xs underline text-muted-foreground hover:text-foreground"
          >
            Odśwież
          </button>
        </div>
      </div>

      {/* Company info */}
      {company && (
        <div className="rounded-lg border bg-card p-4">
          <SectionTitle title="Firma" />
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Nazwa:</span>{" "}
              <span className="font-semibold">{company.name || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">NIP:</span>{" "}
              <span className="font-mono">{company.nip || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">REGON:</span>{" "}
              <span className="font-mono">{company.regon || "—"}</span>
            </div>
            {(company as any).street && (
              <div>
                <span className="text-muted-foreground">Adres:</span>{" "}
                <span>
                  {(company as any).street}, {(company as any).postalCode} {(company as any).city}
                </span>
              </div>
            )}
            {(company as any).www && (
              <div>
                <span className="text-muted-foreground">WWW:</span>{" "}
                <span className="font-mono">{(company as any).www}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table counts */}
      <div>
        <SectionTitle title="Rekordy w Subiekt GT" />
        {statsLoading && <LoadingRow />}
        {stats && (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="tw__Towar"
              value={String(stats.products)}
              hint="Kartoteki towarowe"
              icon={<Package className="h-4 w-4" />}
              tone="primary"
            />
            <KpiCard
              label="sl_Magazyn"
              value={String(stats.warehouses)}
              hint="Magazyny"
              icon={<MapPin className="h-4 w-4" />}
              tone="success"
            />
            <KpiCard
              label="pd_Uzytkownik"
              value={String(stats.users)}
              hint="Operatorzy"
              icon={<Users className="h-4 w-4" />}
              tone="info"
            />
          </div>
        )}
      </div>

      {/* Connection config form */}
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
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="10.10.254.87\OPTIMA"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">Port</label>
            <input
              type="number"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 1433 })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Baza danych
            </label>
            <input
              type="text"
              value={form.database}
              onChange={(e) => setForm({ ...form, database: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="pomagier"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Użytkownik
            </label>
            <input
              type="text"
              value={form.user}
              onChange={(e) => setForm({ ...form, user: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="sa"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium uppercase text-muted-foreground">Hasło</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="Pozostaw puste aby nie zmieniać"
            />
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div
            className={`mt-3 rounded-md p-3 text-sm ${testResult.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
          >
            {testResult.ok
              ? `✓ Połączono pomyślnie (${testResult.latencyMs} ms)`
              : `✗ ${testResult.error || "Błąd połączenia"}`}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleTest}
            disabled={testing || !form.host}
            className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <FlaskConical className="h-4 w-4" />
            {testing ? "Testuję…" : "Testuj połączenie"}
          </button>
          <button
            onClick={() => saveMut.mutate(form)}
            disabled={saveMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveMut.isPending ? "Zapisuję…" : "Zapisz"}
          </button>
        </div>
      </div>

      {/* Field mappings */}
      <div className="rounded-lg border bg-card p-4 max-w-2xl">
        <SectionTitle
          title="Mapowanie pól"
          description="Powiąż funkcje PomagierGT z polami własnymi Subiekt GT"
        />
        {fieldMappings && fieldMappings.length > 0 && (
          <div className="mt-4 space-y-3">
            {fieldMappings.map((fm) => (
              <div
                key={fm.key}
                className="flex items-center gap-3 rounded-md border bg-muted/20 p-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold">{fm.label}</div>
                  <div className="text-xs text-muted-foreground">
                    PomagierGT → Subiekt GT ({fm.subiektTable})
                  </div>
                </div>
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                <select
                  value={fieldMapByKey.get(fm.key)?.subiektField || fm.subiektField}
                  onChange={(e) =>
                    setFieldMap((prev) =>
                      fieldMapByKey.has(fm.key)
                        ? prev.map((m) =>
                            m.key === fm.key ? { ...m, subiektField: e.target.value } : m,
                          )
                        : [...prev, { key: fm.key, subiektField: e.target.value }],
                    )
                  }
                  className="rounded-md border bg-background px-2 py-1.5 text-sm font-mono"
                >
                  {AVAILABLE_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <button
              onClick={() => saveMappingsMut.mutate(fieldMap)}
              disabled={saveMappingsMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saveMappingsMut.isPending ? "Zapisuję…" : "Zapisz mapowanie"}
            </button>
          </div>
        )}
        {(!fieldMappings || fieldMappings.length === 0) && (
          <p className="text-sm text-muted-foreground mt-3">Brak skonfigurowanych mapowań pól.</p>
        )}
      </div>
    </div>
  );
}
