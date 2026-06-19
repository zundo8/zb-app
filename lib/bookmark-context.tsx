"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ShopifyProduct } from "./shopify-admin";
import { useSession } from "next-auth/react";

interface BookmarkContextType {
  bookmarks: ShopifyProduct[];
  addBookmark: (product: ShopifyProduct) => void;
  removeBookmark: (productId: string) => void;
  isBookmarked: (productId: string) => boolean;
  toggleBookmark: (product: ShopifyProduct) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const BookmarkContext = createContext<BookmarkContextType | null>(null);

const STORAGE_KEY = "zb_bookmarks_v1";

export function BookmarkProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<ShopifyProduct[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { data: session, status } = useSession();

  // 1. Initial load from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse bookmarks", e);
      }
    }
  }, []);

  // 2. Persist to local storage whenever bookmarks change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  // 3. Load and merge bookmarks from database when authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const fetchDbBookmarks = async () => {
        try {
          const res = await fetch("/api/wishlist");
          if (res.ok) {
            const data = await res.json();
            if (data.items && Array.isArray(data.items)) {
              const dbProducts = data.items.map((item: any) => item.product);
              
              setBookmarks((prev) => {
                const merged = [...prev];
                
                // Add DB items to local state if missing
                for (const p of dbProducts) {
                  if (!merged.some((m) => m.id.toString() === p.id.toString())) {
                    merged.push(p);
                  }
                }

                // Add local-only items to the database
                const localOnly = prev.filter(p => !dbProducts.some((db: any) => db.id.toString() === p.id.toString()));
                for (const p of localOnly) {
                  fetch("/api/wishlist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productId: p.id.toString() })
                  }).catch(err => console.error("Failed to sync local bookmark to DB:", err));
                }

                return merged;
              });
            }
          }
        } catch (e) {
          console.error("Error syncing wishlist from DB:", e);
        }
      };
      fetchDbBookmarks();
    }
  }, [status, session]);

  const addBookmark = useCallback((product: ShopifyProduct) => {
    setBookmarks((prev) => {
      if (prev.find((p) => p.id === product.id)) return prev;
      return [...prev, product];
    });

    if (status === "authenticated") {
      fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id.toString() })
      }).catch(err => console.error("Failed to add bookmark to DB:", err));
    }
  }, [status]);

  const removeBookmark = useCallback((productId: string) => {
    setBookmarks((prev) => prev.filter((p) => p.id.toString() !== productId.toString()));

    if (status === "authenticated") {
      fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: productId.toString(), action: "remove" })
      }).catch(err => console.error("Failed to remove bookmark from DB:", err));
    }
  }, [status]);

  const isBookmarked = useCallback((productId: string) => {
    return bookmarks.some((p) => p.id.toString() === productId.toString());
  }, [bookmarks]);

  const toggleBookmark = useCallback((product: ShopifyProduct) => {
    const isCurrentlyBookmarked = bookmarks.some((p) => p.id.toString() === product.id.toString());
    const action = isCurrentlyBookmarked ? "remove" : "add";

    setBookmarks((prev) => {
      if (isCurrentlyBookmarked) {
        return prev.filter((p) => p.id.toString() !== product.id.toString());
      }
      return [...prev, product];
    });

    if (status === "authenticated") {
      fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          productId: product.id.toString(), 
          action: action
        })
      }).catch(err => console.error("Failed to toggle bookmark in DB:", err));
    }
  }, [bookmarks, status]);

  return (
    <BookmarkContext.Provider value={{ bookmarks, addBookmark, removeBookmark, isBookmarked, toggleBookmark, isOpen, setIsOpen }}>
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmarks() {
  const context = useContext(BookmarkContext);
  if (!context) {
    throw new Error("useBookmarks must be used within a BookmarkProvider");
  }
  return context;
}
