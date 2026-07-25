# Backup & Restore System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automated daily backup of Postgres + .env + TLS certs to local disk and S3-compatible storage, with admin UI for configuration, manual backup, restore, and history.

**Architecture:** Cron runs `backup.sh` daily → `pg_dump` + tar + gzip → local retention (7d) + S3 upload (30d). Admin panel manages S3 config, lists backups, triggers manual backup/restore.

**Tech Stack:** `@aws-sdk/client-s3` (S3 client), `pg_dump` (system), `node:crypto` (AES-256), cron, Bash, React + TypeScript (admin UI)

## Global Constraints

- S3 secrets AES-256 encrypted in Postgres `config` table
- Local backups in `/backups/local/`, chmod 700
- S3 retention 30 days, local 7 days
- Restore requires typing "TAK" confirmation
- Cron job added by `setup-prod.sh`
- All API endpoints under `/api/backup/*`

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/backup.sh` | Daily backup: pg_dump + tar + gzip + local save + S3 upload |
| `src/lib/backup-s3.ts` | S3 helpers: upload, list, download, delete |
| `src/lib/backup-crypto.ts` | AES-256 encrypt/decrypt for S3 secrets in config |
| `src/api/server.ts` | 7 backup endpoints (add at end of file) |
| `src/routes/admin.backup.tsx` | Admin UI: config, list, restore |
| `src/components/pomagier/AppShellAdmin.tsx` | Add "Backup" nav item |

## Tasks

### Task 1: Install S3 dependency and create S3 helper

**Files:**
- Modify: `package.json` — add `@aws-sdk/client-s3`
- Create: `src/lib/backup-crypto.ts`
- Create: `src/lib/backup-s3.ts`

**Interfaces:**
- Produces: `encryptSecret(text: string, key: Buffer): string`, `decryptSecret(encrypted: string, key: Buffer): string`
- Produces: `uploadToS3(filename: string, data: Buffer): Promise<void>`, `listS3Files(): Promise<string[]>`, `downloadFromS3(filename: string): Promise<Buffer>`, `deleteFromS3(filename: string): Promise<void>`, `getS3Config(): Promise<{endpoint:string,bucket:string,region:string,accessKey:string,secretKey:string}|null>`

- [ ] **Step 1: Install package**

```bash
cd /pomagier && npm install @aws-sdk/client-s3 2>&1 | tail -3
```
Expected: installs successfully

- [ ] **Step 2: Create src/lib/backup-crypto.ts**

```typescript
import crypto from "node:crypto";

const ALGORITHM = "aes-256-cbc";
const KEY = process.env.BACKUP_ENCRYPTION_KEY || "pomagier-backup-dev-key-32chr!!";

function getKey(): Buffer {
  return crypto.createHash("sha256").update(KEY).digest();
}

export function encryptSecret(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptSecret(encrypted: string): string {
  const [ivHex, dataHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
```

- [ ] **Step 3: Create src/lib/backup-s3.ts**

```typescript
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { decryptSecret } from "./backup-crypto";
import { getDb, schema } from "@/db/index";
import { eq } from "drizzle-orm";

interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
}

async function getS3Config(): Promise<S3Config | null> {
  try {
    const db = getDb();
    const rows = await db.select().from(schema.config);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    if (!map.s3_endpoint || !map.s3_bucket || !map.s3_access_key) return null;
    return {
      endpoint: map.s3_endpoint,
      bucket: map.s3_bucket,
      region: map.s3_region || "us-east-1",
      accessKey: map.s3_access_key,
      secretKey: map.s3_secret_key ? decryptSecret(map.s3_secret_key) : "",
    };
  } catch { return null; }
}

function getClient(config: S3Config) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    forcePathStyle: true,
  });
}

export async function uploadToS3(filename: string, data: Buffer): Promise<void> {
  const config = await getS3Config();
  if (!config) throw new Error("S3 not configured");
  const client = getClient(config);
  await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: `backups/${filename}`, Body: data }));
}

export async function listS3Files(): Promise<string[]> {
  const config = await getS3Config();
  if (!config) return [];
  const client = getClient(config);
  const result = await client.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: "backups/" }));
  return (result.Contents || []).map(o => o.Key?.replace("backups/", "") || "").filter(Boolean);
}

export async function downloadFromS3(filename: string): Promise<Buffer> {
  const config = await getS3Config();
  if (!config) throw new Error("S3 not configured");
  const client = getClient(config);
  const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: `backups/${filename}` }));
  return Buffer.from(await result.Body!.transformToByteArray());
}

export async function deleteFromS3(filename: string): Promise<void> {
  const config = await getS3Config();
  if (!config) return;
  const client = getClient(config);
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: `backups/${filename}` }));
}

export async function testS3Connection(config: S3Config): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getClient(config);
    await client.send(new ListObjectsV2Command({ Bucket: config.bucket, MaxKeys: 1 }));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/backup-crypto.ts src/lib/backup-s3.ts
git commit -m "feat: backup S3 helpers + AES-256 crypto for secrets"
```

---

### Task 2: Create backup shell script

**Files:**
- Create: `scripts/backup.sh`

- [ ] **Step 1: Create scripts/backup.sh**

```bash
#!/bin/bash
set -e
BACKUP_DIR="/backups/local"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# 1. pg_dump from Docker
docker exec pomagier-db pg_dump -U pomagier pomagier > "$BACKUP_DIR/pomagier_${TIMESTAMP}.sql" 2>/tmp/backup-err.log

# 2. Tar .env + certs
tar -czf "$BACKUP_DIR/config_${TIMESTAMP}.tar.gz" -C /pomagier .env -C /root/certs . 2>/dev/null || true

# 3. Combined archive
cd "$BACKUP_DIR"
tar -czf "pomagier_backup_${TIMESTAMP}.tar.gz" "pomagier_${TIMESTAMP}.sql" "config_${TIMESTAMP}.tar.gz"
rm "pomagier_${TIMESTAMP}.sql" "config_${TIMESTAMP}.tar.gz"

# 4. Clean old local backups
find "$BACKUP_DIR" -name "pomagier_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Local backup: pomagier_backup_${TIMESTAMP}.tar.gz ($(du -h "$BACKUP_DIR/pomagier_backup_${TIMESTAMP}.tar.gz" | cut -f1))"

# 5. Upload to S3 (non-blocking — failure doesn't stop the script)
if [ -f "$BACKUP_DIR/pomagier_backup_${TIMESTAMP}.tar.gz" ]; then
  echo "[$(date)] Uploading to S3..."
  # Upload via API endpoint (handles S3 internally)
  curl -s -X POST http://localhost:3000/api/backup/upload-local \
    -H "Content-Type: application/json" \
    -d "{\"file\":\"pomagier_backup_${TIMESTAMP}.tar.gz\"}" 2>/dev/null || echo "[$(date)] S3 upload failed (non-critical)"
fi

echo "[$(date)] Backup complete."
```

- [ ] **Step 2: Set permissions**

```bash
chmod 700 /backups/local
chmod +x /pomagier/scripts/backup.sh
```

- [ ] **Step 3: Add cron job to setup-prod.sh**

Append to `scripts/setup-prod.sh`:
```bash
# Cron: daily backup at 3:00 AM
mkdir -p /backups/local
chmod 700 /backups/local
(crontab -l 2>/dev/null; echo "0 3 * * * /pomagier/scripts/backup.sh >> /var/log/pomagier-backup.log 2>&1") | crontab -
```

- [ ] **Step 4: Commit**

```bash
git add scripts/backup.sh scripts/setup-prod.sh
git commit -m "feat: backup shell script + cron in setup-prod.sh"
```

---

### Task 3: Add backup API endpoints

**Files:**
- Modify: `src/api/server.ts` — add endpoints before `const port = ...`

**Interfaces:**
- Consumes: `encryptSecret`, `decryptSecret` from `backup-crypto.ts`
- Consumes: `uploadToS3`, `listS3Files`, `downloadFromS3`, `deleteFromS3`, `testS3Connection` from `backup-s3.ts`
- Consumes: `getDb`, `schema` from `db/index.ts`

- [ ] **Step 1: Add imports at top of server.ts**

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { encryptSecret, decryptSecret } from "../lib/backup-crypto.ts";
import { uploadToS3, listS3Files, downloadFromS3, deleteFromS3, testS3Connection, getS3Config } from "../lib/backup-s3.ts";
```

Wait — those imports may conflict. Use dynamic import inside endpoints instead:

In each endpoint, add:
```typescript
const { encryptSecret, decryptSecret } = await import("../lib/backup-crypto.ts");
```

- [ ] **Step 2: Add endpoints before `const port = ...`**

Insert this block just before `const port = parseInt(...)`:

```typescript
// === Backup & Restore ===

// S3 config
app.get("/api/backup/config", async (_req, res) => {
  try {
    const db = getDb();
    const rows = await db.select().from(schema.config);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    res.json({
      endpoint: map.s3_endpoint || "",
      bucket: map.s3_bucket || "",
      region: map.s3_region || "us-east-1",
      accessKey: map.s3_access_key || "",
      secretKey: map.s3_secret_key ? "••••••••" : "",
    });
  } catch { res.json({}); }
});

app.put("/api/backup/config", async (req, res) => {
  const { endpoint, bucket, region, accessKey, secretKey } = req.body ?? {};
  if (!endpoint || !bucket || !accessKey) { res.status(400).json({ error: "Brak wymaganych pól" }); return; }
  try {
    const db = getDb();
    const { encryptSecret } = await import("../lib/backup-crypto.ts");
    const entries: any[] = [
      { key: "s3_endpoint", value: endpoint },
      { key: "s3_bucket", value: bucket },
      { key: "s3_region", value: region || "us-east-1" },
      { key: "s3_access_key", value: accessKey },
    ];
    if (secretKey && secretKey !== "••••••••") {
      entries.push({ key: "s3_secret_key", value: encryptSecret(secretKey) });
    }
    for (const e of entries) {
      await db.insert(schema.config).values(e).onConflictDoUpdate({ target: schema.config.key, set: { value: e.value } });
    }
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/api/backup/test-s3", async (req, res) => {
  const { endpoint, bucket, region, accessKey, secretKey } = req.body ?? {};
  if (!endpoint || !bucket || !accessKey) { res.status(400).json({ error: "Brak wymaganych pól" }); return; }
  try {
    const { testS3Connection } = await import("../lib/backup-s3.ts");
    const result = await testS3Connection({ endpoint, bucket, region, accessKey, secretKey });
    res.json(result);
  } catch (err: any) { res.json({ ok: false, error: err.message }); }
});

// Run backup now
app.post("/api/backup/run", async (_req, res) => {
  try {
    const { execSync } = await import("node:child_process");
    const output = execSync("bash /pomagier/scripts/backup.sh 2>&1", { timeout: 120000 }).toString();
    const match = output.match(/pomagier_backup_\d{4}-\d{2}-\d{2}_\d{4}\.tar\.gz/);
    res.json({ ok: true, filename: match?.[0] || "unknown", output: output.slice(-200) });
  } catch (err: any) { res.status(500).json({ error: err.message || err.stderr?.toString() }); }
});

// List backups
app.get("/api/backup/list", async (_req, res) => {
  const localDir = "/backups/local";
  const local: { name: string; size: number; date: string; source: string }[] = [];
  try {
    const { readdirSync, statSync } = await import("node:fs");
    for (const f of readdirSync(localDir)) {
      if (!f.endsWith(".tar.gz")) continue;
      const stat = statSync(`${localDir}/${f}`);
      local.push({ name: f, size: stat.size, date: stat.mtime.toISOString(), source: "local" });
    }
  } catch {}

  let s3: any[] = [];
  try {
    const { listS3Files } = await import("../lib/backup-s3.ts");
    const files = await listS3Files();
    s3 = files.map(f => ({ name: f, size: 0, date: new Date().toISOString(), source: "s3" }));
  } catch {}

  res.json([...local, ...s3].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
});

// Download backup
app.get("/api/backup/download/:name", async (req, res) => {
  const name = req.params.name;
  const source = req.query.source || "local";
  try {
    if (source === "s3") {
      const { downloadFromS3 } = await import("../lib/backup-s3.ts");
      const data = await downloadFromS3(name);
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename=${name}`);
      res.send(data);
    } else {
      const localPath = `/backups/local/${name}`;
      if (!name.includes("..") && (await import("node:fs")).existsSync(localPath)) {
        res.download(localPath);
      } else {
        res.status(404).json({ error: "File not found" });
      }
    }
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Delete backup
app.delete("/api/backup/:name", async (req, res) => {
  const name = req.params.name;
  const source = req.query.source || "local";
  try {
    if (source === "s3") {
      const { deleteFromS3 } = await import("../lib/backup-s3.ts");
      await deleteFromS3(name);
    }
    const localPath = `/backups/local/${name}`;
    const { unlinkSync, existsSync } = await import("node:fs");
    if (existsSync(localPath)) unlinkSync(localPath);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Restore from uploaded file
app.post("/api/backup/restore", async (req, res) => {
  // This is a placeholder — full restore requires file upload handling
  // which Express 5 with raw body parsing needs multipart handling
  // For MVP: restore from local file by name
  const { filename, confirm } = req.body ?? {};
  if (confirm !== "TAK") { res.status(400).json({ error: "Wpisz TAK aby potwierdzić przywrócenie" }); return; }
  if (!filename) { res.status(400).json({ error: "Brak nazwy pliku" }); return; }

  try {
    const { execSync } = await import("node:child_process");
    const localPath = `/backups/local/${filename}`;
    // Extract
    execSync(`cd /tmp && tar -xzf "${localPath}"`, { timeout: 30000 });
    const sqlFile = filename.replace(".tar.gz", ".sql");
    // Restore
    execSync(`docker exec -i pomagier-db psql -U pomagier pomagier < /tmp/${sqlFile}`, { timeout: 60000 });
    execSync(`rm -f /tmp/${sqlFile} /tmp/config_*.tar.gz`);
    res.json({ ok: true, message: "Baza przywrócona. Zrestartuj API aby załadować nową konfigurację." });
  } catch (err: any) { res.status(500).json({ error: err.message || err.stderr?.toString() }); }
});

// Upload local backup to S3
app.post("/api/backup/upload-local", async (req, res) => {
  const { file } = req.body ?? {};
  if (!file) { res.status(400).json({ error: "Brak nazwy pliku" }); return; }
  try {
    const localPath = `/backups/local/${file}`;
    const data = (await import("node:fs")).readFileSync(localPath);
    const { uploadToS3 } = await import("../lib/backup-s3.ts");
    await uploadToS3(file, data);
    res.json({ ok: true });
  } catch (err: any) { res.status(200).json({ ok: false, error: err.message }); }
});
```

- [ ] **Step 3: Build and typecheck**

```bash
cd /pomagier && npx tsc --noEmit 2>&1 | head -10
```
Expected: no errors

- [ ] **Step 4: Test endpoints**

```bash
systemctl restart pomagier-api && sleep 10
curl -s http://localhost:3000/api/backup/list
curl -s http://localhost:3000/api/backup/config
```
Expected: `[]` and `{}` (empty config)

- [ ] **Step 5: Commit**

```bash
git add src/api/server.ts
git commit -m "feat: backup API — config, run, list, download, delete, restore"
```

---

### Task 4: Create admin backup page

**Files:**
- Create: `src/routes/admin.backup.tsx`
- Modify: `src/components/pomagier/AppShellAdmin.tsx` — add nav item

- [ ] **Step 1: Create src/routes/admin.backup.tsx**

```typescript
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
```

- [ ] **Step 2: Add nav item in AppShellAdmin.tsx**

Find the navItems array and add:
```typescript
{ title: "Backup", url: "/admin/backup", icon: Database },
```
after "Konfiguracja ERP" entry.

- [ ] **Step 3: Build, test**

```bash
cd /pomagier && npx tsc --noEmit 2>&1 | head -5 && npx vite build 2>&1 | tail -3
```
Expected: no errors, build succeeds

- [ ] **Step 4: Test admin page**

```bash
systemctl restart pomagier-vite && sleep 5
curl -sk -o /dev/null -w "%{http_code}" https://localhost/admin/backup
```
Expected: 200

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.backup.tsx src/components/pomagier/AppShellAdmin.tsx
git commit -m "feat: admin backup page — config, list, restore UI"
```

---

### Task 5: Verify full flow + finalize

- [ ] **Step 1: Test backup script manually**

```bash
mkdir -p /backups/local && chmod 700 /backups/local
bash /pomagier/scripts/backup.sh
ls -la /backups/local/
```
Expected: backup file created in /backups/local/

- [ ] **Step 2: Test via API**

```bash
curl -s -X POST http://localhost:3000/api/backup/run
curl -s http://localhost:3000/api/backup/list | head -c 200
```
Expected: JSON with list of backups

- [ ] **Step 3: Verify cron (check it's added)**

```bash
crontab -l | grep backup
```
Expected: line with `0 3 * * * /pomagier/scripts/backup.sh`

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "chore: finalize backup system — create dirs, verify cron"
```
