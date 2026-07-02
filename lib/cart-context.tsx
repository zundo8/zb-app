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

import { getClientCookie, setClientCookie } from "@/lib/metaPixel";

const STORAGE_KEY = "zb_cart_v1";

// ─── Provider ────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from localStorage on mount and check for cart recovery URL
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}

    // Check for "?recover=CART_ID" in the browser query parameters
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const recoverId = params.get("recover");
      if (recoverId) {
        const loadRecoveredCart = async () => {
          try {
            const res = await fetch(`/api/cart/recover?id=${recoverId}`);
            if (res.ok) {
              const data = await res.json();
              if (data && Array.isArray(data.items) && data.items.length > 0) {
                const mappedItems = data.items.map((item: any) => ({
                  id: `${item.productId}_${item.variantId || ""}_${item.size || "one-size"}`,
                  productId: item.productId,
                  variantId: item.variantId || "",
                  handle: item.handle || "",
                  title: item.title || "Product",
                  price: String(item.price || 0),
                  image: item.image || "",
                  quantity: item.quantity || 1,
                  size: item.size || null,
                }));
                setItems(mappedItems);
                
                // Remove recover parameter from URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
              }
            }
          } catch (err) {
            console.error("Cart recovery failed:", err);
          }
        };
        loadRecoveredCart();
      }
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Synchronize cart with backend on updates (debounced)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let deviceId = getClientCookie("zb_device_id");
    if (!deviceId) {
      deviceId = `guest_web_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)}`;
      setClientCookie("zb_device_id", deviceId, 365);
    }

    const syncCartWithBackend = async () => {
      try {
        await fetch("/api/cart/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            guestId: deviceId,
            source: "webstore"
          })
        });
      } catch (err) {
        console.error("Cart background sync failed:", err);
      }
    };

    const timer = setTimeout(syncCartWithBackend, 1000);
    return () => clearTimeout(timer);
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
