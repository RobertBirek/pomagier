import sql from "mssql";
import type { ErpAdapter } from "./adapter";
import type { ProductInfo, ScanResult } from "./types";
import { getEnv } from "@/lib/env";
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

  async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool) return this.pool;
    const env = getEnv();

    const hostParts = env.MSSQL_HOST.split("\\");
    const server = hostParts[0];
    const instanceName = hostParts.length > 1 ? hostParts[1] : undefined;

    const config: sql.config = {
      server,
      port: instanceName ? undefined : env.MSSQL_PORT,
      database: env.MSSQL_DATABASE,
      user: env.MSSQL_USER,
      password: env.MSSQL_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 10000,
        requestTimeout: 10000,
        ...(instanceName ? { instanceName } : {}),
      },
    };
    this.pool = await sql.connect(config);
    logger.info(
      { host: env.MSSQL_HOST, database: env.MSSQL_DATABASE },
      "MSSQL connection pool created",
    );
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
