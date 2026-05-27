import { create } from 'zustand';

interface UIStore {
  isLoading: boolean;
  isOffline: boolean;
  isTabBarVisible: boolean;
  isCartOpen: boolean;
  isWishlistOpen: boolean;
  isMenuOpen: boolean;
  isAppActive: boolean;
  setLoading: (loading: boolean) => void;
  setOffline: (offline: boolean) => void;
  setTabBarVisible: (visible: boolean) => void;
  setCartOpen: (open: boolean) => void;
  setWishlistOpen: (open: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  setAppActive: (active: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isLoading: false,
  isOffline: false,
  isTabBarVisible: true,
  isCartOpen: false,
  isWishlistOpen: false,
  isMenuOpen: false,
  isAppActive: true,
  setLoading: (loading) => set({ isLoading: loading }),
  setOffline: (offline) => set({ isOffline: offline }),
  setTabBarVisible: (visible) => set({ isTabBarVisible: visible }),
  setCartOpen: (open) => set({ isCartOpen: open }),
  setWishlistOpen: (open) => set({ isWishlistOpen: open }),
  setMenuOpen: (open) => set({ isMenuOpen: open }),
  setAppActive: (active) => set({ isAppActive: active }),
}));
