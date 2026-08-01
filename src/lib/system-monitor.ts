import * as os from "node:os";
import { logEvent } from "./app-logger.js";

const MEMORY_THRESHOLD = 0.8;
const DISK_FREE_THRESHOLD = 0.1;
const THROTTLE_MS = 5 * 60 * 1000;

let lastMemoryWarning = 0;
let lastDiskWarning = 0;

async function checkMemory(): Promise<void> {
  const mem = process.memoryUsage();
  const ratio = mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0;
  if (ratio <= MEMORY_THRESHOLD) return;

  const now = Date.now();
  if (now - lastMemoryWarning < THROTTLE_MS) return;
  lastMemoryWarning = now;

  await logEvent({
    category: "system",
    action: "memory.warning",
    method: "system",
    success: true,
    details: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      ratio: Number(ratio.toFixed(2)),
    },
  });
}

async function checkDisk(): Promise<void> {
  const total = os.totalmem();
  const free = os.freemem();
  const ratio = total > 0 ? free / total : 0;
  if (ratio >= DISK_FREE_THRESHOLD) return;

  const now = Date.now();
  if (now - lastDiskWarning < THROTTLE_MS) return;
  lastDiskWarning = now;

  await logEvent({
    category: "system",
    action: "disk.warning",
    method: "system",
    success: true,
    details: {
      freeMb: Math.round(free / 1024 / 1024),
      totalMb: Math.round(total / 1024 / 1024),
      ratio: Number(ratio.toFixed(2)),
    },
  });
}

async function tick(): Promise<void> {
  try {
    await checkMemory();
    await checkDisk();
  } catch {
    /* ignore */
  }
}

export function startSystemMonitor(intervalMs = 300_000): NodeJS.Timeout {
  return setInterval(() => {
    void tick();
  }, intervalMs);
}
