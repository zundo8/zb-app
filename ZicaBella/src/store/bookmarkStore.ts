import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlatProduct } from '../api/types';
import { config } from '../constants/config';

interface BookmarkStore {
  bookmarks: FlatProduct[];
  addBookmark: (product: FlatProduct, token?: string | null) => Promise<void>;
  removeBookmark: (productId: string, token?: string | null) => Promise<void>;
  isBookmarked: (productId: string) => boolean;
  clearBookmarks: () => void;
  syncBookmarks: (token: string) => Promise<void>;
}

export const useBookmarkStore = create<BookmarkStore>()(
  persist(
    (set, get) => ({
      bookmarks: [],

      addBookmark: async (product, token) => {
        const { bookmarks } = get();
        if (bookmarks.find((b) => b.id === product.id)) return;
        
        // Update local state immediately
        set({ bookmarks: [...bookmarks, product] });

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
            console.error("Failed to sync bookmark addition:", e);
          }
        }
      },

      removeBookmark: async (productId, token) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== productId),
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
            console.error("Failed to sync bookmark removal:", e);
          }
        }
      },

      isBookmarked: (productId) =>
        get().bookmarks.some((b) => b.id === productId),

      clearBookmarks: () => set({ bookmarks: [] }),

      syncBookmarks: async (token) => {
        try {
          const res = await fetch(`${config.appUrl}/api/wishlist`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const json = await res.json();
          if (res.ok && json.items) {
            // Map the API response (Wishlist item with product) to FlatProduct[]
            const synced = json.items.map((item: any) => item.product);
            set({ bookmarks: synced });
          }
        } catch (e) {
          console.error("Failed to sync bookmarks:", e);
        }
      }
    }),
    {
      name: 'zicabella-bookmarks',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
