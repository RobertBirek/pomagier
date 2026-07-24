import type { ErpAdapter } from "./adapter";
import type { ProductInfo, ScanResult, StockInfo } from "./types";

const mockStocks: StockInfo[] = [
  {
    warehouseId: 1,
    warehouseSymbol: "MAG",
    warehouseName: "Główny",
    quantity: 120,
    reserved: 5,
    minQuantity: 10,
    maxQuantity: 500,
  },
  {
    warehouseId: 2,
    warehouseSymbol: "MAP",
    warehouseName: "Magazyn pomocniczy",
    quantity: 35,
    reserved: 0,
    minQuantity: 0,
    maxQuantity: 200,
  },
];

const mockProducts: ProductInfo[] = [
  {
    productId: 1,
    symbol: "A_GAZ_ZIEMNY",
    name: "Gaz ziemny",
    description: "Gaz ziemny",
    barcode: "5901234567890",
    unit: "m3",
    vatRate: "23%",
    stocks: [...mockStocks],
  },
  {
    productId: 2,
    symbol: "A_OLEJ",
    name: "Olej napędowy",
    description: "Olej napędowy",
    barcode: "5901234567891",
    unit: "l",
    vatRate: "23%",
    stocks: mockStocks.map((s) => ({ ...s, quantity: s.quantity * 0.8 })),
  },
  {
    productId: 3,
    symbol: "A_WEGIEL",
    name: "Węgiel eko-groszek",
    description: "",
    barcode: "5901234567892",
    unit: "kg",
    vatRate: "23%",
    stocks: mockStocks.map((s) => ({ ...s, quantity: s.quantity * 2 })),
  },
  {
    productId: 42,
    symbol: "TEST_TOWAR",
    name: "Towar testowy",
    description: "Towar do testów",
    barcode: "1234567890123",
    unit: "szt",
    vatRate: "23%",
    stocks: [
      {
        warehouseId: 1,
        warehouseSymbol: "MAG",
        warehouseName: "Główny",
        quantity: 42,
        reserved: 0,
        minQuantity: 0,
        maxQuantity: 1000,
      },
    ],
  },
];

export class MockErpAdapter implements ErpAdapter {
  async scan(code: string): Promise<ScanResult> {
    const matching = mockProducts.filter((p) => p.barcode === code || p.symbol === code);
    return {
      found: matching.length > 0,
      barcode: code,
      products: matching,
    };
  }

  async getProductInfo(_towId: number, _magId: number): Promise<ProductInfo> {
    throw new Error("Not implemented in mock adapter");
  }

  async healthCheck() {
    return { ok: true, latencyMs: 1 };
  }
}
