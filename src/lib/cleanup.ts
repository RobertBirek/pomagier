import { getDb, schema } from "../db/index.js";
import { logger } from "./logger.js";
import { lt } from "drizzle-orm";

const CLEANUP_DAYS = 30;

export async function runCleanup(): Promise<{ auditDeleted: number; movementsDeleted: number }> {
  const db = getDb();
  const cutoff = new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000);

  const auditResult = await db.delete(schema.auditLog).where(lt(schema.auditLog.createdAt, cutoff));

  const movementsResult = await db
    .delete(schema.productMovements)
    .where(lt(schema.productMovements.createdAt, cutoff));

  const auditDeleted = (auditResult as unknown as { count?: number | null }).count ?? 0;
  const movementsDeleted =
    (movementsResult as unknown as { count?: number | null }).count ?? 0;

  logger.info({ auditDeleted, movementsDeleted, cutoffDays: CLEANUP_DAYS }, "Cleanup completed");

  return { auditDeleted, movementsDeleted };
}

export function startCleanupInterval(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  return setInterval(() => {
    runCleanup().catch((err) => {
      logger.error({ err }, "Cleanup failed");
    });
  }, intervalMs);
}
