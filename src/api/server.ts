import express from "express";
import cors from "cors";
import { MssqlErpAdapter } from "../erp/mssql.adapter.ts";
import { MockErpAdapter } from "../erp/mock.adapter.ts";
import type { ErpAdapter } from "../erp/adapter.ts";
import { logger } from "../lib/logger.ts";

const app = express();
app.use(cors());
app.use(express.json());

let erpAdapter: ErpAdapter | null = null;

function getAdapter(): ErpAdapter {
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

app.get("/api/health", async (_req, res) => {
  const adapter = getAdapter();
  const erpHealth = await adapter.healthCheck();
  res.json({ status: "ok", timestamp: new Date().toISOString(), erp: erpHealth });
});

app.post("/api/scan", async (req, res) => {
  const { code } = req.body ?? {};

  if (!code || typeof code !== "string" || code.length > 50) {
    res.status(422).json({ error: "Invalid code", found: false, barcode: code ?? "", products: [] });
    return;
  }

  try {
    const adapter = getAdapter();
    const result = await adapter.scan(code.trim());
    logger.info({ code, found: result.found }, "Scan completed");
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ERP error";
    logger.error({ err, code }, "Scan failed");
    res.status(502).json({ error: message, found: false, barcode: code, products: [] });
  }
});

const port = parseInt(process.env.API_PORT ?? "3001", 10);
app.listen(port, () => {
  logger.info({ port }, "API server started");
});
