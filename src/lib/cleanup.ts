import { getDb, schema } from "../db/index.js";
import { logger } from "./logger.js";
import { lt } from "drizzle-orm";

const CLEANUP_DAYS = 30;

export async function runCleanup(): Promise<{ auditDeleted: number; movementsDeleted: number }> {
  const db = getDb();
  const cutoff = new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000);

  const { auditDeleted, movementsDeleted } = await db.transaction(async (tx) => {
    const auditResult = await tx
      .delete(schema.auditLog)
      .where(lt(schema.auditLog.createdAt, cutoff));

    const movementsResult = await tx
      .delete(schema.productMovements)
      .where(lt(schema.productMovements.createdAt, cutoff));

    return {
      auditDeleted: (auditResult as unknown as { count?: number | null }).count ?? 0,
      movementsDeleted: (movementsResult as unknown as { count?: number | null }).count ?? 0,
    };
  });

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
