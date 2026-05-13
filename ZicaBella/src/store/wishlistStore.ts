import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlatProduct } from '../api/types';
import { config } from '../constants/config';

interface WishlistStore {
  wishlist: FlatProduct[];
  addWishlist: (product: FlatProduct, token?: string | null) => Promise<void>;
  removeWishlist: (productId: string, token?: string | null) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  clearWishlist: () => void;
  syncWishlist: (token: string) => Promise<void>;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      wishlist: [],

      addWishlist: async (product, token) => {
        const { wishlist } = get();
        if (wishlist.find((b) => b.id === product.id)) return;
        
        // Update local state immediately
        set({ wishlist: [...wishlist, product] });

        // If authenticated, sync with server
        if (token) {
          try {
            await fetch(`${config.appUrl}/api/wishlist`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ productId: product.id, action: 'add' }),
            });
          } catch (e) {
            console.error("Failed to sync wishlist addition:", e);
          }
        }
      },

      removeWishlist: async (productId, token) => {
        set((state) => ({
          wishlist: state.wishlist.filter((b) => b.id !== productId),
        }));

        if (token) {
          try {
            await fetch(`${config.appUrl}/api/wishlist`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ productId, action: 'remove' }),
            });
          } catch (e) {
            console.error("Failed to sync wishlist removal:", e);
          }
        }
      },

      isWishlisted: (productId) =>
        get().wishlist.some((b) => b.id === productId),

      clearWishlist: () => set({ wishlist: [] }),

      syncWishlist: async (token) => {
        try {
          const res = await fetch(`${config.appUrl}/api/wishlist`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          const json = await res.json();
          if (res.ok && json.items) {
            // Map the API response (Wishlist item with product) to FlatProduct structure
            // Ensure we handle potential schema differences
            const synced = json.items.map((item: any) => {
              const p = item.product;
              return {
                id: p.id,
                shopifyId: p.shopifyProductId, // Backward compatibility
                title: p.title,
                handle: p.handle || '',
                featuredImage: p.featuredImage || '',
                images: p.images || [p.featuredImage].filter(Boolean),
                price: String(p.price || '0'),
                variants: p.variants || [],
                description: p.description || '',
                availableForSale: p.availableForSale ?? true,
                isSoldOut: p.isSoldOut ?? false,
                isOnSale: p.isOnSale ?? false,
              } as any;
            });
            set({ wishlist: synced });
          }
        } catch (e) {
          console.error("Failed to sync wishlist:", e);
        }
      }
    }),
    {
      name: 'zicabella-wishlist',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
