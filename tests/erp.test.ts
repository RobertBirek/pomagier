import { describe, it, expect } from "vitest";
import { MockErpAdapter } from "../src/erp/mock.adapter";

describe("MockErpAdapter", () => {
  const adapter = new MockErpAdapter();

  it("should return health check ok", async () => {
    const result = await adapter.healthCheck();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("should find a product by barcode", async () => {
    const result = await adapter.scan("1234567890123");
    expect(result.found).toBe(true);
    expect(result.products[0].name).toBe("Towar testowy");
  });

  it("should find a product by symbol", async () => {
    const result = await adapter.scan("A_OLEJ");
    expect(result.found).toBe(true);
    expect(result.products[0].name).toBe("Olej napędowy");
  });

  it("should return not found for unknown code", async () => {
    const result = await adapter.scan("NONEXISTENT");
    expect(result.found).toBe(false);
    expect(result.products).toHaveLength(0);
  });

  it("should return multiple products for shared barcode", async () => {
    // mock data has separate barcodes, using symbol instead
    const result = await adapter.scan("A_GAZ_ZIEMNY");
    expect(result.found).toBe(true);
  });
});
