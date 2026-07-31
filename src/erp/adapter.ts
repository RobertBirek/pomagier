import type sql from "mssql";
import type { ProductInfo, ScanResult } from "./types";

export interface ErpAdapter {
  scan(code: string, warehouseId?: number | null): Promise<ScanResult>;
  getProductInfo(towId: number, magId: number): Promise<ProductInfo>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  close?(): Promise<void>;
  getPool?(): Promise<sql.ConnectionPool>;
  reconnect?(config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }): Promise<void>;
}
