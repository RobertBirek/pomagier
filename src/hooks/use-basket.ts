import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { beep } from "@/lib/utils";
import type { StockInfo } from "@/erp/types";

const BASKET_KEY = "pomagier-basket";

export interface BasketItem {
  code: string;
  name?: string;
  qty: number;
  stocks?: StockInfo[];
}

interface StoredBasket {
  items: BasketItem[];
  userId: string;
  savedAt: number;
}

function loadBasket(currentUserId: string): BasketItem[] {
  try {
    const raw = localStorage.getItem(BASKET_KEY);
    if (!raw) return [];
    const stored: StoredBasket = JSON.parse(raw);
    // Clear if different user or older than 30 min (safety net)
    if (stored.userId !== currentUserId) return [];
    if (Date.now() - stored.savedAt > 30 * 60 * 1000) return [];
    return stored.items;
  } catch {
    return [];
  }
}

function saveBasket(items: BasketItem[], userId: string) {
  try {
    if (items.length === 0) {
      localStorage.removeItem(BASKET_KEY);
    } else {
      localStorage.setItem(BASKET_KEY, JSON.stringify({ items, userId, savedAt: Date.now() }));
    }
  } catch {
    /* storage full or unavailable */
  }
}

async function lookupProduct(code: string) {
  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.products?.[0];
    }
  } catch {
    /* offline */
  }
  return null;
}

export function useBasket() {
  const { user } = useAuth();
  const currentUserId = user?.id || "";

  const [basket, setBasket] = useState<BasketItem[]>(() => loadBasket(currentUserId));

  // Auto-save on every change
  useEffect(() => {
    saveBasket(basket, currentUserId);
  }, [basket, currentUserId]);

  const totalQty = basket.reduce((s, b) => s + b.qty, 0);

  const addToBasket = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    beep(800, 100);

    setBasket((prev) => {
      const idx = prev.findIndex((b) => b.code === trimmed);
      if (idx >= 0) {
        return prev.map((item, i) => (i === idx ? { ...item, qty: item.qty + 1 } : item));
      }
      lookupProduct(trimmed).then((product) => {
        setBasket((b) =>
          b.map((item) =>
            item.code === trimmed
              ? {
                  ...item,
                  name: product?.name || item.name,
                  stocks: product?.stocks || item.stocks,
                }
              : item,
          ),
        );
      });
      return [...prev, { code: trimmed, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((code: string) => {
    setBasket((b) => b.filter((i) => i.code !== code));
  }, []);

  const updateQty = useCallback((code: string, delta: number) => {
    setBasket((b) =>
      b.reduce<BasketItem[]>((acc, item) => {
        if (item.code !== code) {
          acc.push(item);
          return acc;
        }
        const newQty = Math.max(0, item.qty + delta);
        if (newQty > 0) acc.push({ ...item, qty: newQty });
        return acc;
      }, []),
    );
  }, []);

  const clearBasket = useCallback(() => {
    setBasket([]);
    localStorage.removeItem(BASKET_KEY);
  }, []);

  const flatCodes = basket.flatMap((b) => Array(b.qty).fill(b.code));

  return { basket, totalQty, flatCodes, addToBasket, removeItem, updateQty, clearBasket };
}
