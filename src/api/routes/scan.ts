import type { Application, Request, Response } from "express";
import { z } from "zod";
import { getAdapter } from "../adapter-provider.js";
import { logger } from "../../lib/logger.js";
import { ApiError } from "../error-handler.js";
import { validate } from "../validation.js";

const ScanSchema = z.object({
  code: z.string().min(1).max(50),
});

export function registerScanRoutes(app: Application): void {
  app.post("/api/scan", validate(ScanSchema), async (req: Request, res: Response) => {
    const { code } = req.body;

    try {
      const adapter = getAdapter();
      const result = await adapter.scan(code.trim());
      logger.info({ code: code.trim(), found: result.found }, "Scan completed");
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "ERP error";
      logger.error({ err, code }, "Scan failed");
      res.status(502).json({ error: message, found: false, barcode: code, products: [] });
    }
  });
}
