import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // exchange rate relative to base INR
}

export const CURRENCIES: Currency[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', rate: 1.0 },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', rate: 0.012 },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', rate: 0.011 },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', rate: 0.0095 },
  { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', flag: '🇦🇪', rate: 0.044 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦', rate: 0.016 },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar', flag: '🇦🇺', rate: 0.018 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬', rate: 0.016 },
  { code: 'SAR', symbol: 'SAR ', name: 'Saudi Riyal', flag: '🇸🇦', rate: 0.045 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', rate: 1.85 },
];

interface CurrencyStore {
  currentCurrency: Currency;
  setCurrency: (code: string) => void;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      currentCurrency: CURRENCIES[0],
      setCurrency: (code: string) => {
        const found = CURRENCIES.find(c => c.code === code);
        if (found) {
          set({ currentCurrency: found });
        }
      },
    }),
    {
      name: 'zicabella-currency-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
