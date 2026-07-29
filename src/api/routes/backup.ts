import type express from "express";
import { getDb, schema } from "../../db/index.js";
import { requireAdmin } from "../auth-middleware.js";
import { logger } from "../../lib/logger.js";

interface ConfigEntry {
  key: string;
  value: string;
}

function validateBackupFilename(name: unknown): name is string {
  return (
    typeof name === "string" &&
    /^[a-zA-Z0-9_.-]+$/.test(name) &&
    name.length > 0 &&
    name.length <= 256
  );
}

export function registerBackupRoutes(app: express.Express) {
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
    } catch {
      res.json({});
    }
  });

  app.put("/api/backup/config", requireAdmin, async (req, res) => {
    const { endpoint, bucket, region, accessKey, secretKey } = req.body ?? {};
    if (!endpoint || !bucket || !accessKey) {
      res.status(400).json({ error: "Brak wymaganych pól" });
      return;
    }
    try {
      const db = getDb();
      const { encryptSecret } = await import("../../lib/backup-crypto.js");
      const entries: ConfigEntry[] = [
        { key: "s3_endpoint", value: endpoint },
        { key: "s3_bucket", value: bucket },
        { key: "s3_region", value: region || "us-east-1" },
        { key: "s3_access_key", value: accessKey },
      ];
      if (secretKey && secretKey !== "••••••••") {
        entries.push({ key: "s3_secret_key", value: encryptSecret(secretKey) });
      }
      for (const e of entries) {
        await db
          .insert(schema.config)
          .values(e)
          .onConflictDoUpdate({ target: schema.config.key, set: { value: e.value } });
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/backup/test-s3", requireAdmin, async (req, res) => {
    const { endpoint, bucket, region, accessKey, secretKey } = req.body ?? {};
    if (!endpoint || !bucket || !accessKey) {
      res.status(400).json({ error: "Brak wymaganych pól" });
      return;
    }
    try {
      const { testS3Connection } = await import("../../lib/backup-s3.js");
      const result = await testS3Connection({ endpoint, bucket, region, accessKey, secretKey });
      res.json(result);
    } catch (err) {
      res.json({ ok: false, error: (err as Error).message });
    }
  });

  // Run backup now
  app.post("/api/backup/run", requireAdmin, async (_req, res) => {
    try {
      const { execSync } = await import("node:child_process");
      const output = execSync("bash /pomagier/scripts/backup.sh 2>&1", {
        timeout: 120000,
      }).toString();
      const match = output.match(/pomagier_backup_\d{4}-\d{2}-\d{2}_\d{4}\.tar\.gz/);
      res.json({ ok: true, filename: match?.[0] || "unknown", output: output.slice(-200) });
    } catch (err) {
      const e = err as { message?: string; stderr?: { toString?: () => string } };
      res.status(500).json({ error: e.message || e.stderr?.toString?.() });
    }
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
    } catch {
      logger.warn({ err: "local dir not accessible" }, "backup list: local dir skipped");
    }

    let s3: { name: string; size: number; date: string; source: string }[] = [];
    try {
      const { listS3Files } = await import("../../lib/backup-s3.js");
      const files = await listS3Files();
      s3 = files.map((f: string) => ({
        name: f,
        size: 0,
        date: new Date().toISOString(),
        source: "s3",
      }));
    } catch {
      logger.warn({ err: "S3 listing failed" }, "backup list: S3 skipped");
    }

    res.json(
      [...local, ...s3].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    );
  });

  // Download backup
  app.get("/api/backup/download/:name", requireAdmin, async (req, res) => {
    const name = req.params.name;
    if (!validateBackupFilename(name)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const source = req.query.source || "local";
    try {
      if (source === "s3") {
        const { downloadFromS3 } = await import("../../lib/backup-s3.js");
        const data = await downloadFromS3(name);
        res.setHeader("Content-Type", "application/gzip");
        res.setHeader("Content-Disposition", `attachment; filename=${name}`);
        res.send(data);
      } else {
        const localPath = `/backups/local/${name}`;
        const { existsSync } = await import("node:fs");
        if (existsSync(localPath)) {
          res.download(localPath);
        } else {
          res.status(404).json({ error: "File not found" });
        }
      }
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Delete backup
  app.delete("/api/backup/:name", requireAdmin, async (req, res) => {
    const name = req.params.name;
    if (!validateBackupFilename(name)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    const source = req.query.source || "local";
    try {
      if (source === "s3") {
        const { deleteFromS3 } = await import("../../lib/backup-s3.js");
        await deleteFromS3(name);
      }
      const localPath = `/backups/local/${name}`;
      const { unlinkSync, existsSync } = await import("node:fs");
      if (existsSync(localPath)) unlinkSync(localPath);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Restore from uploaded file
  app.post("/api/backup/restore", requireAdmin, async (req, res) => {
    const { filename, confirm } = req.body ?? {};
    if (confirm !== "TAK") {
      res.status(400).json({ error: "Wpisz TAK aby potwierdzić przywrócenie" });
      return;
    }
    if (!validateBackupFilename(filename)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    try {
      const { execSync } = await import("node:child_process");
      const localPath = `/backups/local/${filename}`;

      // Safety: auto-backup current state before restore
      const preRestoreName = `pre-restore-${Date.now()}.tar.gz`;
      try {
        execSync(
          `docker exec pomagier-db pg_dump -U pomagier pomagier > /tmp/pre-restore.sql && cd /tmp && tar -czf "${preRestoreName}" pre-restore.sql && mv "${preRestoreName}" /backups/local/ && rm -f /tmp/pre-restore.sql`,
          { timeout: 60000 },
        );
        logger.info({ preRestoreName }, "Pre-restore safety backup created");
      } catch (e) {
        logger.warn({ err: e }, "Pre-restore backup failed — proceeding anyway");
      }

      execSync(`cd /tmp && tar -xzf "${localPath}"`, { timeout: 30000 });
      const sqlFile = filename.replace(".tar.gz", ".sql");
      execSync(`docker exec -i pomagier-db psql -U pomagier pomagier < /tmp/${sqlFile}`, {
        timeout: 60000,
      });
      execSync(`rm -f /tmp/${sqlFile} /tmp/config_*.tar.gz`);

      logger.warn({ filename }, "Database restored from backup");
      res.json({
        ok: true,
        message: "Baza przywrócona. Zrestartuj API aby załadować nową konfigurację.",
      });
    } catch (err) {
      const e = err as { message?: string; stderr?: { toString?: () => string } };
      res.status(500).json({ error: e.message || e.stderr?.toString?.() });
    }
  });

  // Upload local backup to S3
  app.post("/api/backup/upload-local", requireAdmin, async (req, res) => {
    const { file } = req.body ?? {};
    if (!validateBackupFilename(file)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }
    try {
      const localPath = `/backups/local/${file}`;
      const { readFileSync } = await import("node:fs");
      const data = readFileSync(localPath);
      const { uploadToS3 } = await import("../../lib/backup-s3.js");
      await uploadToS3(file, data);
      res.json({ ok: true });
    } catch (err) {
      res.status(200).json({ ok: false, error: (err as Error).message });
    }
  });
}
