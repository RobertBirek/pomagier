import { logEvent } from "./app-logger.js";

const DB_NAME = "pomagier-offline";
const STORE = "scan-queue";
const DB_VERSION = 1;

export interface QueuedScan {
  id?: number;
  code: string;
  location?: string;
  warehouse?: number;
  timestamp: number;
  idempotencyKey?: string;
}

export interface ReplayItem {
  code: string;
  ok: boolean;
  error?: string;
}

export interface ReplayResult {
  ok: number;
  failed: number;
  items: ReplayItem[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addScanToQueue(
  code: string,
  location?: string,
  warehouse?: number,
  actorSubiektUzId?: number,
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({
      code,
      location,
      warehouse,
      timestamp: Date.now(),
      idempotencyKey: crypto.randomUUID(),
    });
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    await logEvent({
      category: "queue",
      action: "queue.added",
      method: "mobile",
      actorSubiektUzId,
      target: { type: "scan", id: code },
      details: { location, warehouse },
      success: true,
    });
  } catch {
    console.warn("IndexedDB unavailable — scan not queued");
  }
}

export async function getQueueCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const count = tx.objectStore(STORE).count();
    return new Promise((resolve) => {
      count.onsuccess = () => resolve(count.result);
    });
  } catch {
    return 0;
  }
}

export async function getPendingScans(): Promise<QueuedScan[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result);
    });
  } catch {
    return [];
  }
}

export async function clearQueue(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch {
    /* storage unavailable */
  }
}

export async function removeSingleScan(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch {
    /* storage unavailable */
  }
}

export async function replayQueue(
  actorSubiektUzId?: number,
  signal?: AbortSignal,
): Promise<ReplayResult> {
  const scans = await getPendingScans();
  if (scans.length === 0) return { ok: 0, failed: 0, items: [] };

  const items: ReplayItem[] = [];

  for (const scan of scans) {
    if (signal?.aborted) break;

    const startedAt = Date.now();
    try {
      const res = await fetch(scan.location ? "/api/locations/assign" : "/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": scan.idempotencyKey || `offline-${scan.id}`,
        },
        body: JSON.stringify(
          scan.location
            ? { codes: [scan.code], location: scan.location, warehouse: scan.warehouse }
            : { code: scan.code, warehouse: scan.warehouse },
        ),
        signal,
      });

      if (res.ok) {
        await removeSingleScan(scan.id!);
        items.push({ code: scan.code, ok: true });
        await logEvent({
          category: "queue",
          action: "queue.replayed_ok",
          method: "mobile",
          actorSubiektUzId,
          target: { type: "scan", id: scan.code },
          success: true,
          durationMs: Date.now() - startedAt,
        });
      } else {
        let message = `${res.status}`;
        try {
          const body = await res.json();
          message = body.error || body.message || message;
        } catch {
          /* non-JSON response */
        }

        if (res.status === 409) {
          await logEvent({
            category: "queue",
            action: "queue.conflict",
            method: "mobile",
            actorSubiektUzId,
            target: { type: "scan", id: scan.code },
            success: false,
            errorMessage: message,
            durationMs: Date.now() - startedAt,
            details: { location: scan.location, httpStatus: 409 },
          });
        } else {
          await logEvent({
            category: "queue",
            action: "queue.replayed_failed",
            method: "mobile",
            actorSubiektUzId,
            target: { type: "scan", id: scan.code },
            success: false,
            errorMessage: message,
            durationMs: Date.now() - startedAt,
          });
        }

        items.push({ code: scan.code, ok: false, error: message });
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") break;
      const message = e instanceof Error ? e.message : "Aborted";
      items.push({
        code: scan.code,
        ok: false,
        error: message,
      });
      await logEvent({
        category: "queue",
        action: "queue.replayed_failed",
        method: "mobile",
        actorSubiektUzId,
        target: { type: "scan", id: scan.code },
        success: false,
        errorMessage: message,
      });
    }
  }

  const ok = items.filter((i) => i.ok).length;
  const failed = items.filter((i) => !i.ok).length;
  return { ok, failed, items };
}
