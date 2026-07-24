import sql from "mssql";
import type { ErpAdapter } from "./adapter";
import type { ProductInfo, ScanResult } from "./types";
import { logger } from "@/lib/logger";

interface ProductRow {
  productId: number;
  symbol: string;
  name: string;
  description: string;
  barcode: string;
  unit: string;
  warehouseId: number | null;
  warehouseSymbol: string | null;
  warehouseName: string | null;
  quantity: number;
  reserved: number;
  minQuantity: number;
  maxQuantity: number;
}

export class MssqlErpAdapter implements ErpAdapter {
  private pool: sql.ConnectionPool | null = null;
  private config: { host: string; port: number; database: string; user: string; password: string } | null = null;

  async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool) return this.pool;
    if (this.config) {
      return this._connect(this.config);
    }
    return this._connect({
      host: process.env.MSSQL_HOST || "localhost",
      port: parseInt(process.env.MSSQL_PORT || "1433"),
      database: process.env.MSSQL_DATABASE || "",
      user: process.env.MSSQL_USER || "",
      password: process.env.MSSQL_PASSWORD || "",
    });
  }

  async reconnect(config: { host: string; port: number; database: string; user: string; password: string }): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
    this.config = config;
    // Test connection immediately
    await this._connect(config);
    logger.info("MSSQL reconnected with new config");
  }

  private async _connect(cfg: { host: string; port: number; database: string; user: string; password: string }): Promise<sql.ConnectionPool> {
    const hostParts = cfg.host.split("\\");
    const server = hostParts[0];
    const instanceName = hostParts.length > 1 ? hostParts[1] : undefined;

    const sqlConfig: sql.config = {
      server,
      port: instanceName ? undefined : cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 10000,
        ...(instanceName ? { instanceName } : {}),
      },
    };
    this.pool = await sql.connect(sqlConfig);
    logger.info({ host: cfg.host, database: cfg.database }, "MSSQL connection pool created");
    return this.pool;
  }

  async scan(code: string): Promise<ScanResult> {
    const pool = await this.getPool();

    const result = await pool.request().input("code", sql.VarChar(50), code).query(`
        SELECT
          t.tw_Id AS productId,
          t.tw_Symbol AS symbol,
          t.tw_Nazwa AS name,
          ISNULL(t.tw_Opis, '') AS description,
          ISNULL(t.tw_PodstKodKresk, '') AS barcode,
          ISNULL(t.tw_JednMiary, 'szt') AS unit,
          s.st_MagId AS warehouseId,
          m.mag_Symbol AS warehouseSymbol,
          m.mag_Nazwa AS warehouseName,
          ISNULL(s.st_Stan, 0) AS quantity,
          ISNULL(s.st_StanRez, 0) AS reserved,
          ISNULL(s.st_StanMin, 0) AS minQuantity,
          ISNULL(s.st_StanMax, 0) AS maxQuantity
        FROM tw__Towar t
        LEFT JOIN tw_Stan s ON s.st_TowId = t.tw_Id
        LEFT JOIN sl_Magazyn m ON m.mag_Id = s.st_MagId
        WHERE t.tw_PodstKodKresk = @code
           OR t.tw_Symbol = @code
           OR t.tw_Id = (
             SELECT usk_IdSynchronizacja
             FROM uf_SynchroKodyKresk
             WHERE usk_Kod = @code
           )
        ORDER BY m.mag_Symbol
      `);

    const products = result.recordset.reduce<ProductInfo[]>((acc, rawRow) => {
      const row = rawRow as ProductRow;
      let product = acc.find((p) => p.productId === row.productId);
      if (!product) {
        product = {
          productId: row.productId,
          symbol: row.symbol,
          name: row.name,
          description: row.description,
          barcode: row.barcode,
          unit: row.unit,
          vatRate: "",
          stocks: [],
        };
        acc.push(product);
      }
      if (row.warehouseId) {
        product.stocks.push({
          warehouseId: row.warehouseId,
          warehouseSymbol: row.warehouseSymbol ?? "",
          warehouseName: row.warehouseName ?? "",
          quantity: row.quantity,
          reserved: row.reserved,
          minQuantity: row.minQuantity,
          maxQuantity: row.maxQuantity,
        });
      }
      return acc;
    }, []);

    logger.info({ code, productCount: products.length }, "MSSQL scan query executed");
    return { found: products.length > 0, barcode: code, products };
  }

  async getProductInfo(towId: number, magId: number): Promise<ProductInfo> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input("towId", sql.Int, towId)
      .input("magId", sql.Int, magId).query(`
        SELECT
          t.tw_Id AS productId,
          t.tw_Symbol AS symbol,
          t.tw_Nazwa AS name,
          ISNULL(t.tw_Opis, '') AS description,
          ISNULL(t.tw_PodstKodKresk, '') AS barcode,
          ISNULL(t.tw_JednMiary, 'szt') AS unit,
          s.st_MagId AS warehouseId,
          m.mag_Symbol AS warehouseSymbol,
          m.mag_Nazwa AS warehouseName,
          ISNULL(s.st_Stan, 0) AS quantity,
          ISNULL(s.st_StanRez, 0) AS reserved,
          ISNULL(s.st_StanMin, 0) AS minQuantity,
          ISNULL(s.st_StanMax, 0) AS maxQuantity
        FROM tw__Towar t
        LEFT JOIN tw_Stan s ON s.st_TowId = t.tw_Id AND s.st_MagId = @magId
        LEFT JOIN sl_Magazyn m ON m.mag_Id = s.st_MagId
        WHERE t.tw_Id = @towId
      `);

    const row = result.recordset[0];
    if (!row) {
      throw new Error(`Product not found: towId=${towId}`);
    }

    return {
      productId: row.productId,
      symbol: row.symbol,
      name: row.name,
      description: row.description,
      barcode: row.barcode,
      unit: row.unit,
      vatRate: "",
      stocks: row.warehouseId
        ? [
            {
              warehouseId: row.warehouseId,
              warehouseSymbol: row.warehouseSymbol,
              warehouseName: row.warehouseName,
              quantity: row.quantity,
              reserved: row.reserved,
              minQuantity: row.minQuantity,
              maxQuantity: row.maxQuantity,
            },
          ]
        : [],
    };
  }

  async healthCheck() {
    const start = Date.now();
    try {
      const pool = await this.getPool();
      await pool.request().query("SELECT 1");
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false, latencyMs: Date.now() - start, error: message };
    }
  }
}
