import { MssqlErpAdapter } from "../erp/mssql.adapter.js";
import { MockErpAdapter } from "../erp/mock.adapter.js";
import type { ErpAdapter } from "../erp/adapter.js";
import { logger } from "../lib/logger.js";

let erpAdapter: ErpAdapter | null = null;

export function getAdapter(): ErpAdapter {
  if (!erpAdapter) {
    if (process.env.MSSQL_HOST && process.env.MSSQL_HOST !== "{{MSSQL_HOST}}") {
      erpAdapter = new MssqlErpAdapter();
      logger.info("API using MSSQL adapter");
    } else {
      erpAdapter = new MockErpAdapter();
      logger.info("API using Mock adapter");
    }
  }
  return erpAdapter;
}
