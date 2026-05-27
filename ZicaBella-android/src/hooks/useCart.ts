import { useCartStore, CartItem } from '../store/cartStore';
import { haptics } from '../utils/haptics';

export function useCart() {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const total = useCartStore((s) => s.total);
  const itemCount = useCartStore((s) => s.itemCount);

  const add = (item: Omit<CartItem, 'id' | 'quantity'>) => {
    addItem(item);
    haptics.addToCart();
  };

  const remove = (id: string) => {
    removeItem(id);
  };

  const update = (id: string, quantity: number) => {
    updateQuantity(id, quantity);
    haptics.quantityChange();
  };

  return {
    items,
    add,
    remove,
    update,
    clear: clearCart,
    total: total(),
    count: itemCount(),
  };
}
