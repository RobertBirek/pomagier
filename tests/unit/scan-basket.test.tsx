/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ScanBasketProvider, useScanBasket, type BasketItem } from "../../src/lib/scan-basket.js";
import type { ReactNode } from "react";

const productItem: BasketItem = {
  type: "product",
  code: "5901234567890",
  productId: 1,
  symbol: "TEST-001",
  name: "Test Product",
  barcode: "5901234567890",
  unit: "szt",
  locations: [{ code: "A 1-2-3-4" }],
};

const locationItem: BasketItem = {
  type: "location",
  code: "B 5-2-1-1",
  productCount: 3,
};

function wrapper({ children }: { children: ReactNode }) {
  return <ScanBasketProvider>{children}</ScanBasketProvider>;
}

describe("useScanBasket", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with empty basket", () => {
    const { result } = renderHook(() => useScanBasket(), { wrapper });

    expect(result.current.items).toEqual([]);
  });

  it("adds items to basket (newest first)", () => {
    const { result } = renderHook(() => useScanBasket(), { wrapper });

    act(() => result.current.addItem(productItem));
    act(() => result.current.addItem(locationItem));

    // Newest first
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toEqual(locationItem);
    expect(result.current.items[1]).toEqual(productItem);
  });

  it("removes item by index", () => {
    const { result } = renderHook(() => useScanBasket(), { wrapper });

    act(() => result.current.addItem(productItem));
    act(() => result.current.addItem(locationItem));
    act(() => result.current.removeItem(0));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual(productItem);
  });

  it("clears basket", () => {
    const { result } = renderHook(() => useScanBasket(), { wrapper });

    act(() => result.current.addItem(productItem));
    act(() => result.current.addItem(locationItem));
    act(() => result.current.clearBasket());

    expect(result.current.items).toEqual([]);
  });

  it("returns no-op basket outside provider", () => {
    const { result } = renderHook(() => useScanBasket());

    expect(result.current.items).toEqual([]);
    // Should not throw
    act(() => result.current.addItem(productItem));
    act(() => result.current.removeItem(0));
    act(() => result.current.clearBasket());
  });
});
