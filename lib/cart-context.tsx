"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { trackStorefrontEvent } from "@/lib/track-client";

// ─── Types ────────────────────────────────────────────────

export interface CartItem {
  id: string;             // "productId_variantId_size"
  productId: string;
  handle: string;         // SEO-friendly URL slug
  variantId: string;
  title: string;
  size: string | null;
  price: string;
  image: string;
  quantity: number;
  category?: string;
}

interface CartContextType {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "id" | "quantity">) => void;
  remove: (id: string) => void;
  update: (id: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "zb_cart_v1";

// ─── Provider ────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((item: Omit<CartItem, "id" | "quantity">) => {
    const id = `${item.productId}_${item.variantId}_${item.size || "one-size"}`;
    
    // Track Add To Cart event
    trackStorefrontEvent('Add To Cart', {
      productId: item.productId,
      metadata: {
        title: item.title,
        price: item.price,
        size: item.size
      }
    });

    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, id, quantity: 1 }];
    });
  }, []);

  const remove = useCallback((id: string) => {
    // Find item details first to track Removal
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        trackStorefrontEvent('Remove From Cart', {
          productId: item.productId,
          metadata: {
            title: item.title,
            price: item.price,
            size: item.size
          }
        });
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const update = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, quantity } : i))
      );
    }
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider value={{ items, count, subtotal, add, remove, update, clear }}>
      {children}
    </CartContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
