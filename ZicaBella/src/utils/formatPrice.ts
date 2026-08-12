import { useCurrencyStore, CURRENCIES } from '../store/currencyStore';

export function formatPrice(amount: string | number | undefined | null, overrideCurrencyCode?: string): string {
  if (amount === undefined || amount === null || amount === '') return '';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '';

  const storeCurrency = useCurrencyStore.getState().currentCurrency;
  const currency = overrideCurrencyCode 
    ? (CURRENCIES.find(c => c.code === overrideCurrencyCode) || storeCurrency)
    : storeCurrency;

  const converted = num * currency.rate;

  if (currency.code === 'INR' || currency.code === 'JPY') {
    return `${currency.symbol}${Math.round(converted).toLocaleString('en-US')}`;
  }

  return `${currency.symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
