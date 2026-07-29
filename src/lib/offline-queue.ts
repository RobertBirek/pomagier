const DB_NAME = "pomagier-offline";
const STORE = "scan-queue";
const DB_VERSION = 1;

export interface QueuedScan {
  id?: number;
  code: string;
  location?: string;
  timestamp: number;
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

export async function addScanToQueue(code: string, location?: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ code, location, timestamp: Date.now() });
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
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

export async function replayQueue(signal?: AbortSignal): Promise<ReplayResult> {
  const scans = await getPendingScans();
  if (scans.length === 0) return { ok: 0, failed: 0, items: [] };

  const items: ReplayItem[] = [];

  for (const scan of scans) {
    if (signal?.aborted) break;

    try {
      const res = await fetch(scan.location ? "/api/locations/assign" : "/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scan.location ? { codes: [scan.code], location: scan.location } : { code: scan.code },
        ),
        signal,
      });

      if (res.ok) {
        await removeSingleScan(scan.id!);
        items.push({ code: scan.code, ok: true });
      } else {
        let message = `${res.status}`;
        try {
          const body = await res.json();
          message = body.error || body.message || message;
        } catch {
          /* non-JSON response */
        }
        items.push({ code: scan.code, ok: false, error: message });
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") break;
      items.push({
        code: scan.code,
        ok: false,
        error: e instanceof Error ? e.message : "Brak połączenia",
      });
    }
  }

  const ok = items.filter((i) => i.ok).length;
  const failed = items.filter((i) => !i.ok).length;
  return { ok, failed, items };
}
