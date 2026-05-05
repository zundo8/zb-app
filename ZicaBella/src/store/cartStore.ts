import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  id: string;
  productId: string;
  handle: string;
  variantId: string;
  title: string;
  size: string | null;
  price: string;
  image: string;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  shippingAddress: any | null;

  addItem: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setShippingAddress: (address: any) => void;

  // Computed (via get())
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      shippingAddress: null,

      addItem: (item) => {
        const id = `${item.productId}_${item.variantId}_${item.size || 'one-size'}`;
        set((state) => {
          const existing = state.items.find((i) => i.id === id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === id ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, id, quantity: 1 }] };
        });
      },

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),

      updateQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity === 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        })),

      clearCart: () => set({ items: [], cartId: null, shippingAddress: null }),

      setShippingAddress: (address) => set({ shippingAddress: address }),

      total: () =>
        get().items.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0),

      itemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'zicabella-cart',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
