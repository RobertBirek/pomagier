export interface StockInfo {
  warehouseId: number;
  warehouseSymbol: string;
  warehouseName: string;
  quantity: number;
  reserved: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface ProductInfo {
  productId: number;
  symbol: string;
  name: string;
  description: string;
  barcode: string;
  unit: string;
  vatRate: string;
  stocks: StockInfo[];
}

export interface ScanResult {
  found: boolean;
  barcode: string;
  products: ProductInfo[];
}
