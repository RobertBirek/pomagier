import type { Application, Request, Response } from "express";
import { getAdapter } from "../adapter-provider.js";
import { logger } from "../../lib/logger.js";
import { logEvent } from "../../lib/app-logger-server.js";
import type { CompanyRow } from "../types.js";

export function registerHealthRoutes(app: Application): void {
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      const adapter = getAdapter();
      const erpHealth = await adapter.healthCheck();
      res.json({ status: "ok", timestamp: new Date().toISOString(), erp: erpHealth });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown";
      logger.error({ err }, "Health check failed");
      await logEvent({
        category: "system",
        action: "health.fail",
        method: "system",
        target: { type: "health", id: "api" },
        success: false,
        errorMessage: message,
      });
      res.status(503).json({ status: "error", timestamp: new Date().toISOString() });
    }
  });

  app.get("/api/company", async (_req: Request, res: Response) => {
    try {
      const adapter = getAdapter();
      const pool = await adapter.getPool?.();

      if (!pool) {
        res.json({ name: "PomagierGT (no pool)", nip: "", regon: "" });
        return;
      }

      const result = await pool.request().query(`
        SELECT TOP 1
          adr_NazwaPelna AS name,
          adr_Nazwa AS shortName,
          adr_NIP AS nip,
          CAST(pd_Regon AS varchar) AS regon,
          adr_Ulica AS street,
          adr_NrDomu AS houseNo,
          adr_NrLokalu AS aptNo,
          adr_Kod AS postalCode,
          adr_Miejscowosc AS city,
          adr_Telefon AS phone,
          pd_WWW AS www,
          pd_Email AS email,
          NazwaBanku AS bankName,
          NumerRachunku AS bankAccount
        FROM vwFeniksFirmaSync
      `);

      const row = result.recordset[0] as CompanyRow | undefined;

      res.json({
        name: row?.name || row?.shortName || "Podmiot",
        shortName: row?.shortName || "",
        nip: row?.nip || "",
        regon: row?.regon || "",
        street: row?.street
          ? `${row.street} ${row.houseNo || ""}${row.aptNo ? `/${row.aptNo}` : ""}`
          : "",
        postalCode: row?.postalCode || "",
        city: row?.city || "",
        phone: row?.phone || "",
        www: row?.www || "",
        email: row?.email || "",
        bankName: row?.bankName || "",
        bankAccount: row?.bankAccount || "",
      });
    } catch (err) {
      logger.error({ err }, "Company query failed");
      res.json({ name: "PomagierGT (demo)", nip: "", regon: "" });
    }
  });
}
