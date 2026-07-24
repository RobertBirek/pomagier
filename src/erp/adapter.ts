import type sql from "mssql";
import type { ProductInfo, ScanResult } from "./types";

export interface ErpAdapter {
  scan(code: string): Promise<ScanResult>;
  getProductInfo(towId: number, magId: number): Promise<ProductInfo>;
  healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  getPool?(): Promise<sql.ConnectionPool>;
}
