import type { Application, Request, Response } from "express";

export function registerCaRoutes(app: Application): void {
  app.get("/api/ca", async (_req: Request, res: Response) => {
    const fs = await import("node:fs");
    const caPath = process.env.MKCERT_CAROOT
      ? `${process.env.MKCERT_CAROOT}/rootCA.pem`
      : "/root/.local/share/mkcert/rootCA.pem";
    try {
      const cert = fs.readFileSync(caPath, "utf-8");
      res.setHeader("Content-Type", "application/x-pem-file");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=rootCA.${_req.query.format === "crt" ? "crt" : "pem"}`,
      );
      res.send(cert);
    } catch {
      res.status(404).json({ error: "CA cert not found" });
    }
  });

  app.get("/ca", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(
      `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"/><title>Pobierz certyfikat</title></head><body style="font-family:system-ui;padding:20px;text-align:center"><h2>Certyfikat PomagierGT</h2><p>Kliknij przycisk aby pobrać i zainstalować:</p><a href="/api/ca" download="rootCA.crt" style="display:inline-block;background:#1e40af;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;touch-action:manipulation">\uD83D\uDCE5 Pobierz rootCA.crt</a><p style="margin-top:20px;color:#666;font-size:14px">Po pobraniu: Ustawienia \u2192 Bezpiecze\u0144stwo \u2192 Zainstaluj certyfikat</p></body></html>`,
    );
  });
}
