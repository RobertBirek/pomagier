import { createServerFn } from "@tanstack/react-start";
import { MssqlErpAdapter } from "@/erp/mssql.adapter";
import { MockErpAdapter } from "@/erp/mock.adapter";
import type { ErpAdapter } from "@/erp/adapter";
import type { ScanResult } from "@/erp/types";
import { withCorrelation, logger } from "@/lib/logger";
import { z } from "zod";

let erpAdapter: ErpAdapter | null = null;

function getAdapter(): ErpAdapter {
  if (!erpAdapter) {
    if (process.env.MSSQL_HOST && process.env.MSSQL_HOST !== "{{MSSQL_HOST}}") {
      erpAdapter = new MssqlErpAdapter();
      logger.info("Using MSSQL adapter");
    } else {
      erpAdapter = new MockErpAdapter();
      logger.info("Using Mock adapter");
    }
  }
  return erpAdapter;
}

export const healthCheck = createServerFn({ method: "GET" }).handler(async () => {
  const adapter = getAdapter();
  const erp = await adapter.healthCheck();
  return { status: "ok", timestamp: new Date().toISOString(), services: { erp } };
});

export const scanCode = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().min(1).max(50) }))
  .handler(async ({ data }): Promise<ScanResult> => {
    return withCorrelation(async () => {
      const adapter = getAdapter();
      const result = await adapter.scan(data.code);
      logger.info({ code: data.code, found: result.found }, "Scan completed");
      return result;
    });
  });
