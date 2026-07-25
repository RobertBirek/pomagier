import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SectionTitle, LoadingRow, StatusBadge } from "@/components/pomagier/primitives";
import { Database, Download, Trash2, Play, Upload, Shield, CheckCircle2, X, HardDrive, Cloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function fetchBackupConfig() {
  const r = await fetch("/api/backup/config");
  return r.json() as Promise<{ endpoint: string; bucket: string; region: string; accessKey: string; secretKey: string }>;
}
async function saveBackupConfig(data: any) {
  const r = await fetch("/api/backup/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
async function testS3(data: any) {
  const r = await fetch("/api/backup/test-s3", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return r.json() as Promise<{ ok: boolean; error?: string }>;
}
async function runBackup() {
  const r = await fetch("/api/backup/run", { method: "POST" });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<{ ok: boolean; filename: string; output: string }>;
}
async function fetchBackups() {
  const r = await fetch("/api/backup/list");
  return r.json() as Promise<{ name: string; size: number; date: string; source: string }[]>;
}
async function restoreBackup(filename: string) {
  const r = await fetch("/api/backup/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename, confirm: "TAK" }) });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
async function deleteBackup(name: string, source: string) {
  const r = await fetch(`/api/backup/${name}?source=${source}`, { method: "DELETE" });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

export const Route = createFileRoute("/admin/backup")({ component: AdminBackup });

function AdminBackup() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"config" | "backups" | "restore">("backups");
  const [s3Form, setS3Form] = useState({ endpoint: "", bucket: "", region: "us-east-1", accessKey: "", secretKey: "" });
  const [formSynced, setFormSynced] = useState(false);
  const [s3TestResult, setS3TestResult] = useState<any>(null);
  const [restoreFile, setRestoreFile] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState("");

  const { data: config } = useQuery({ queryKey: ["backup-config"], queryFn: fetchBackupConfig });
  const { data: backups } = useQuery({ queryKey: ["backups"], queryFn: fetchBackups, refetchInterval: 15000 });

  if (config && !formSynced) { setS3Form(config); setFormSynced(true); }

  const saveMut = useMutation({ mutationFn: saveBackupConfig, onSuccess: () => toast.success("Konfiguracja zapisana"), onError: (e: any) => toast.error(e.message) });
  const testS3Mut = useMutation({ mutationFn: testS3, onSuccess: (d) => { setS3TestResult(d); d.ok ? toast.success("Połączono") : toast.error(d.error); }, onError: (e: any) => toast.error(e.message) });
  const backupMut = useMutation({ mutationFn: runBackup, onSuccess: (d) => { toast.success(`Backup: ${d.filename}`); qc.invalidateQueries({ queryKey: ["backups"] }); }, onError: (e: any) => toast.error(e.message) });
  const restoreMut = useMutation({ mutationFn: () => restoreBackup(restoreFile), onSuccess: () => toast.success("Baza przywrócona — zrestartuj API"), onError: (e: any) => toast.error(e.message) });
  const deleteMut = useMutation({ mutationFn: ({ name, source }: { name: string; source: string }) => deleteBackup(name, source), onSuccess: () => { toast.success("Usunięto"); qc.invalidateQueries({ queryKey: ["backups"] }); }, onError: (e: any) => toast.error(e.message) });

  const tabs = [
    { key: "config", label: "Konfiguracja S3", icon: Cloud },
    { key: "backups", label: "Backupy", icon: Database },
    { key: "restore", label: "Przywracanie", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Backup i przywracanie</h1>
        <p className="text-sm text-muted-foreground">Automatyczny backup bazy danych, konfiguracji i certyfikatów</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* Tab: Config */}
      {tab === "config" && (
        <div className="max-w-xl space-y-4">
          <SectionTitle title="Konfiguracja S3" description="AWS S3, MinIO, Cloudflare R2, Backblaze B2" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="text-xs font-medium">Endpoint</label><input value={s3Form.endpoint} onChange={e => setS3Form({ ...s3Form, endpoint: e.target.value })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" placeholder="https://s3.amazonaws.com" /></div>
            <div><label className="text-xs font-medium">Bucket</label><input value={s3Form.bucket} onChange={e => setS3Form({ ...s3Form, bucket: e.target.value })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" placeholder="pomagier-backups" /></div>
            <div><label className="text-xs font-medium">Region</label><input value={s3Form.region} onChange={e => setS3Form({ ...s3Form, region: e.target.value })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" /></div>
            <div><label className="text-xs font-medium">Access Key</label><input value={s3Form.accessKey} onChange={e => setS3Form({ ...s3Form, accessKey: e.target.value })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" /></div>
            <div className="sm:col-span-2"><label className="text-xs font-medium">Secret Key</label><input type="password" value={s3Form.secretKey} onChange={e => setS3Form({ ...s3Form, secretKey: e.target.value })} className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm font-mono" placeholder="Pozostaw puste aby nie zmieniać" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => testS3Mut.mutate(s3Form)} disabled={testS3Mut.isPending} className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">Testuj połączenie</button>
            <button onClick={() => saveMut.mutate(s3Form)} disabled={saveMut.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Zapisz</button>
          </div>
          {s3TestResult && <div className={`rounded p-3 text-sm ${s3TestResult.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{s3TestResult.ok ? `✅ Połączono` : `❌ ${s3TestResult.error}`}</div>}
        </div>
      )}

      {/* Tab: Backups */}
      {tab === "backups" && (
        <div className="space-y-4">
          <button onClick={() => backupMut.mutate()} disabled={backupMut.isPending} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Play className="h-4 w-4" />{backupMut.isPending ? "Wykonuję…" : "Wykonaj backup teraz"}
          </button>

          {backups && backups.length > 0 ? (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="px-4 py-2 text-left">Plik</th><th className="px-4 py-2 text-left">Źródło</th><th className="px-4 py-2 text-right hidden sm:table-cell">Rozmiar</th><th className="px-4 py-2 text-right">Data</th><th className="px-4 py-2 w-20" /></tr></thead>
                <tbody>
                  {backups.map(b => (
                    <tr key={b.name} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs truncate max-w-[200px]">{b.name}</td>
                      <td className="px-4 py-2"><StatusBadge tone={b.source === "s3" ? "info" : "success"}>{b.source === "s3" ? <Cloud className="inline h-3 w-3 mr-1" /> : <HardDrive className="inline h-3 w-3 mr-1" />}{b.source}</StatusBadge></td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground hidden sm:table-cell">{b.size > 0 ? `${(b.size / 1024).toFixed(0)} KB` : "—"}</td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground">{new Date(b.date).toLocaleDateString("pl-PL")}</td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <a href={`/api/backup/download/${b.name}?source=${b.source}`} className="touch-target rounded p-1 hover:bg-accent" title="Pobierz"><Download className="h-3.5 w-3.5" /></a>
                          <button onClick={() => { if (confirm("Usunąć backup?")) deleteMut.mutate({ name: b.name, source: b.source }); }} className="touch-target rounded p-1 hover:bg-accent text-destructive" title="Usuń"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted-foreground">Brak backupów. Uruchom pierwszy backup.</p>}
        </div>
      )}

      {/* Tab: Restore */}
      {tab === "restore" && (
        <div className="max-w-xl space-y-4">
          <SectionTitle title="Przywróć z backupu" description="Wybierz plik backupu do przywrócenia. Operacja nadpisuje obecną bazę danych." />
          <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive font-semibold text-sm mb-2"><Shield className="h-4 w-4" />UWAGA: Ta operacja nadpisze wszystkie dane!</div>
            <select value={restoreFile} onChange={e => setRestoreFile(e.target.value)} className="w-full rounded border bg-background px-3 py-2 text-sm font-mono mb-3">
              <option value="">— wybierz backup —</option>
              {backups?.map(b => <option key={b.name} value={b.name}>{b.name} ({b.source})</option>)}
            </select>
            <input value={restoreConfirm} onChange={e => setRestoreConfirm(e.target.value)} placeholder='Wpisz "TAK" aby potwierdzić' className="w-full rounded border bg-background px-3 py-2 text-sm font-mono mb-3" />
            <button onClick={() => restoreMut.mutate()} disabled={restoreMut.isPending || !restoreFile || restoreConfirm !== "TAK"} className="w-full rounded-md bg-destructive py-2.5 text-sm font-medium text-destructive-foreground disabled:opacity-50">
              {restoreMut.isPending ? "Przywracam…" : "Przywróć bazę"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
