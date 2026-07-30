import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export interface BasketProductItem {
  type: "product";
  code: string;
  productId: number;
  symbol: string;
  name: string;
  barcode: string;
  unit: string;
  locations: { code: string }[];
}

export interface BasketLocationItem {
  type: "location";
  code: string;
  productCount: number;
}

export type BasketItem = BasketProductItem | BasketLocationItem;

interface ScanBasketContextValue {
  items: BasketItem[];
  addItem: (item: BasketItem) => void;
  removeItem: (index: number) => void;
  clearBasket: () => void;
}

const BASKET_KEY = "pomagier-scan-basket";

function loadBasket(): BasketItem[] {
  try {
    const raw = localStorage.getItem(BASKET_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as BasketItem[];
    return [];
  } catch {
    return [];
  }
}

const ScanBasketContext = createContext<ScanBasketContextValue | null>(null);

export function ScanBasketProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>(loadBasket);

  const addItem = useCallback((item: BasketItem) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearBasket = useCallback(() => {
    setItems([]);
    localStorage.removeItem(BASKET_KEY);
  }, []);

  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem(BASKET_KEY, JSON.stringify(items));
    } else {
      localStorage.removeItem(BASKET_KEY);
    }
  }, [items]);

  return (
    <ScanBasketContext.Provider value={{ items, addItem, removeItem, clearBasket }}>
      {children}
    </ScanBasketContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScanBasket(): ScanBasketContextValue {
  const ctx = useContext(ScanBasketContext);
  if (!ctx) {
    // Return no-op basket when outside provider (e.g., admin routes)
    return { items: [], addItem: () => {}, removeItem: () => {}, clearBasket: () => {} };
  }
  return ctx;
}
