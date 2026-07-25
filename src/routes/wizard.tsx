import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, ChevronLeft, Database, MapPin, Trash2, Download, ShieldCheck, Server, ArrowRightLeft, Zap } from "lucide-react";

const STEPS = ["MSSQL", "Mapowanie", "Czyszczenie", "Import", "Start"];

export const Route = createFileRoute("/wizard")({ component: WizardPage });

function WizardPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [mssqlForm, setMssqlForm] = useState({ host: "", port: 1433, database: "", user: "", password: "" });
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [mappingField, setMappingField] = useState("tw_Pole1");
  const [clearTables, setClearTables] = useState<string[]>(["locations", "product_locations", "product_movements"]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => { fetch("/api/erp-config").then(r => r.json()).then(d => { if (d.host) setMssqlForm({ host: d.host, port: d.port, database: d.database, user: d.user, password: "" }); }).catch(() => {}); }, []);

  const testMssql = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await fetch("/api/test-connection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(mssqlForm) });
      const d = await r.json(); setTestResult(d);
      if (d.ok) toast.success(`Połączono (${d.latencyMs}ms)`); else toast.error(d.error);
    } catch (e: any) { setTestResult({ ok: false, error: e.message }); }
    finally { setTesting(false); }
  };

  const saveConfig = async () => {
    await fetch("/api/erp-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...mssqlForm, password: mssqlForm.password || undefined }) });
    await fetch("/api/field-mappings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify([{ key: "location", subiektField: mappingField }]) });
  };

  const handleClear = async () => {
    setClearing(true);
    const r = await fetch("/api/wizard/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tables: clearTables }) });
    if (r.ok) toast.success("Wyczyszczono");
    else toast.error("Błąd czyszczenia");
    setClearing(false);
  };

  const handleImport = async () => {
    setImporting(true); setImportResult(null);
    const r = await fetch("/api/wizard/import-all", { method: "POST" });
    const d = await r.json();
    setImportResult(d);
    if (d.ok) toast.success("Import zakończony");
    else toast.error(d.error || "Błąd importu");
    setImporting(false);
  };

  const canNext = () => {
    if (step === 0) return testResult?.ok;
    if (step === 1) return true;
    if (step === 2) return true;
    if (step === 3) return importResult?.ok;
    return true;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-all ${i < step ? "bg-success text-white" : i === step ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${i === step ? "font-bold" : "text-muted-foreground"}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`h-0.5 w-6 ${i < step ? "bg-success" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Server className="h-5 w-5 text-primary" />Połączenie MSSQL</h2>
              <p className="text-xs text-muted-foreground">Skonfiguruj połączenie z bazą Insert Subiekt GT</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="text-xs font-medium">Host</label><input value={mssqlForm.host} onChange={e => setMssqlForm({ ...mssqlForm, host: e.target.value })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" placeholder="10.10.254.87\OPTIMA" /></div>
                <div><label className="text-xs font-medium">Port</label><input type="number" value={mssqlForm.port} onChange={e => setMssqlForm({ ...mssqlForm, port: parseInt(e.target.value) || 1433 })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" /></div>
                <div><label className="text-xs font-medium">Baza danych</label><input value={mssqlForm.database} onChange={e => setMssqlForm({ ...mssqlForm, database: e.target.value })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" /></div>
                <div><label className="text-xs font-medium">Użytkownik</label><input value={mssqlForm.user} onChange={e => setMssqlForm({ ...mssqlForm, user: e.target.value })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" /></div>
                <div className="sm:col-span-2"><label className="text-xs font-medium">Hasło</label><input type="password" value={mssqlForm.password} onChange={e => setMssqlForm({ ...mssqlForm, password: e.target.value })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" /></div>
              </div>
              <button onClick={testMssql} disabled={testing || !mssqlForm.host} className="w-full rounded-md border py-2.5 text-sm hover:bg-accent disabled:opacity-50">{testing ? "Testuję…" : "Testuj połączenie"}</button>
              {testResult && (
                <div className={`rounded p-3 text-sm ${testResult.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {testResult.ok ? `✅ Połączono (${testResult.latencyMs}ms)` : `❌ ${testResult.error}`}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" />Mapowanie pól</h2>
              <p className="text-xs text-muted-foreground">Wybierz pole Subiekt GT dla lokalizacji towarów</p>
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex-1"><div className="text-sm font-semibold">Lokalizacja towaru</div><div className="text-xs text-muted-foreground">PomagierGT → tw__Towar</div></div>
                <select value={mappingField} onChange={e => setMappingField(e.target.value)} className="rounded border bg-background px-3 py-2 text-sm font-mono">
                  {["tw_Pole1","tw_Pole2","tw_Pole3","tw_Pole4","tw_Pole5","tw_Pole6","tw_Pole7","tw_Pole8"].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />Czyszczenie bazy</h2>
              <p className="text-xs text-muted-foreground">Wybierz tabele do wyczyszczenia przed importem</p>
              {[
                { key: "locations", label: "Lokalizacje (locations)", desc: "85 rekordów" },
                { key: "product_locations", label: "Powiązania towar-lokalizacja (product_locations)", desc: "397 rekordów" },
                { key: "product_movements", label: "Historia ruchów (product_movements)", desc: "wszystkie wpisy" },
                { key: "users", label: "Użytkownicy/PIN-y (users)", desc: "2 użytkowników" },
              ].map(t => (
                <label key={t.key} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 ${clearTables.includes(t.key) ? "border-destructive/50 bg-destructive/5" : ""}`}>
                  <input type="checkbox" checked={clearTables.includes(t.key)} onChange={() => setClearTables(prev => prev.includes(t.key) ? prev.filter(k => k !== t.key) : [...prev, t.key])} className="mt-0.5" />
                  <div><div className="text-sm font-medium">{t.label}</div><div className="text-xs text-muted-foreground">{t.desc}</div></div>
                </label>
              ))}
              <button onClick={handleClear} disabled={clearing || clearTables.length === 0} className="w-full rounded-md bg-destructive py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">{clearing ? "Czyszczę…" : `Wyczyść ${clearTables.length} tabel(e)`}</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Download className="h-5 w-5 text-primary" />Import danych</h2>
              <p className="text-xs text-muted-foreground">Import lokalizacji, synchronizacja towarów i seed PIN-ów z Subiekt GT</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Zap className="h-3 w-3" />Import lokalizacji z tw_Pole1</div>
                <div className="flex items-center gap-2"><Zap className="h-3 w-3" />Synchronizacja towarów z lokalizacjami</div>
                <div className="flex items-center gap-2"><Zap className="h-3 w-3" />Seed PIN-ów (0000) dla operatorów</div>
              </div>
              <button onClick={handleImport} disabled={importing} className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {importing ? <span className="animate-spin">⏳</span> : <Download className="h-4 w-4" />}
                {importing ? "Importuję…" : "Uruchom pełny import"}
              </button>
              {importResult && (
                <div className={`rounded-lg border p-4 space-y-1 text-sm ${importResult.ok ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5"}`}>
                  {importResult.ok ? (
                    <>
                      <div>✅ Lokalizacje: {importResult.results?.locations?.imported} zaimportowanych</div>
                      <div>✅ Towary: {importResult.results?.productLocations?.inserted} przypisanych</div>
                      <div>✅ Użytkownicy: {importResult.results?.users?.seeded} z PIN-em 0000</div>
                    </>
                  ) : <div className="text-destructive">❌ {importResult.error}</div>}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-success/10 mx-auto"><ShieldCheck className="h-8 w-8 text-success" /></div>
              <h2 className="text-lg font-bold">Konfiguracja zakończona</h2>
              <p className="text-sm text-muted-foreground">System gotowy do pracy. Kliknij poniżej aby przejść do aplikacji.</p>
              <button onClick={() => { window.location.href = "/mobile/login"; }} className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Zap className="inline h-4 w-4 mr-1" />Przejdź do aplikacji
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="inline-flex items-center gap-1 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-30"><ChevronLeft className="h-4 w-4" />Wstecz</button>
          {step < 4 && (
            <button onClick={async () => { if (step === 0 || step === 1) await saveConfig(); setStep(s => Math.min(4, s + 1)); }} disabled={!canNext()} className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-30">Dalej<ChevronRight className="h-4 w-4" /></button>
          )}
        </div>
      </div>
    </div>
  );
}
