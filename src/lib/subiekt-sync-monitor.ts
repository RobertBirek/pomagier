import { getDb, schema } from "../db/index.js";
import { getAdapter } from "../api/adapter-provider.js";
import { eq } from "drizzle-orm";
import { logEvent } from "./app-logger-server.js";
import { logger } from "./logger.js";
import { randomUUID } from "node:crypto";

const THROTTLE_MS = 5 * 60_000;
const LOCATION_FIELD = "tw_Pole1";

let monitorHandle: NodeJS.Timeout | null = null;
let lastRunAt = 0;

export async function getLastSyncAt(): Promise<Date | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.config)
    .where(eq(schema.config.key, "subiekt_last_sync_at"));
  return row?.value ? new Date(row.value) : null;
}

export async function setLastSyncAt(d: Date): Promise<void> {
  const db = getDb();
  const iso = d.toISOString();
  await db
    .insert(schema.config)
    .values({ key: "subiekt_last_sync_at", value: iso })
    .onConflictDoUpdate({
      target: schema.config.key,
      set: { value: iso },
    });
}

async function getLocationFieldSafe(): Promise<string> {
  try {
    const { getLocationField } = await import("../api/routes/locations.js");
    return await getLocationField();
  } catch {
    return LOCATION_FIELD;
  }
}

export async function tickSubiektSync(): Promise<void> {
  const now = Date.now();
  if (now - lastRunAt < THROTTLE_MS) return;
  lastRunAt = now;

  const adapter = getAdapter();
  const pool = await adapter.getPool?.();
  if (!pool) return;

  const correlationId = randomUUID();
  const locationField = await getLocationFieldSafe();

  try {
    const maxResult = await pool.request().query(
      `SELECT MAX(z.twz_CzasModyf) AS m
         FROM tw_ZmianaTw z WITH (NOLOCK)
         INNER JOIN tw__Towar t WITH (NOLOCK) ON t.tw_Id = z.twz_TowarId
         WHERE t.${locationField} IS NOT NULL AND t.${locationField} != ''`,
    );
    const row = maxResult.recordset[0] as { m: Date | null } | undefined;
    const nowSubiektMax = row?.m ? new Date(row.m) : null;
    if (!nowSubiektMax) return;

    const lastSync = await getLastSyncAt();

    if (!lastSync) {
      await setLastSyncAt(nowSubiektMax);
      await logEvent({
        category: "system",
        action: "subiekt.sync.bootstrap",
        method: "system",
        success: true,
        correlationId,
        details: { lastSyncAt: nowSubiektMax.toISOString() },
      });
      return;
    }

    if (nowSubiektMax > lastSync) {
      const countResult = await pool
        .request()
        .input("since", lastSync)
        .query(
          `SELECT COUNT(DISTINCT z.twz_TowarId) AS n
           FROM tw_ZmianaTw z WITH (NOLOCK)
           INNER JOIN tw__Towar t WITH (NOLOCK) ON t.tw_Id = z.twz_TowarId
           WHERE z.twz_CzasModyf > @since
             AND t.${locationField} IS NOT NULL AND t.${locationField} != ''`,
        );
      const countRow = countResult.recordset[0] as { n: number } | undefined;
      const count = countRow?.n ?? 0;

      await setLastSyncAt(nowSubiektMax);

      await logEvent({
        category: "system",
        action: "subiekt.modified",
        method: "system",
        success: true,
        correlationId,
        details: {
          count,
          lastSyncAt: lastSync.toISOString(),
          nowSubiektMax: nowSubiektMax.toISOString(),
        },
      });
    }
  } catch (err) {
    logger.error({ err, correlationId }, "Subiekt sync monitor tick failed");
    await logEvent({
      category: "system",
      action: "subiekt.sync.error",
      method: "system",
      success: false,
      correlationId,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startSubiektSyncMonitor(intervalMs = THROTTLE_MS): NodeJS.Timeout {
  void tickSubiektSync();
  monitorHandle = setInterval(() => {
    void tickSubiektSync();
  }, intervalMs);
  return monitorHandle;
}

export function getSubiektSyncHandle(): NodeJS.Timeout | null {
  return monitorHandle;
}
