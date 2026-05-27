import { useThemeStore } from '../store/themeStore';

const common = {
  sale: '#FF0000',
  saleBadgeBg: 'rgba(5, 5, 6, 0.85)',
  soldOut: '#999999',
  soldOutBg: 'rgba(0, 0, 0, 0.4)',
  badge: '#FF0000',
  tabBar: '#000000',
  tabActive: '#FFFFFF',
  tabInactive: '#666666',
  cartBadge: '#FF3B30',
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  info: '#007AFF',
  iosBlue: '#007AFF',
  iosGreen: '#34C759',
  iosRed: '#FF3B30',
  iosGray: '#8E8E93',
  razorpay: '#000000',
};

export const lightTheme = {
  ...common,
  primary: '#000000',
  background: '#FFFFFF',
  foreground: '#050506',
  surface: 'rgba(0, 0, 0, 0.03)',
  surfaceElevated: '#FFFFFF',
  // Light mode cards should read as white surfaces with separation via shadow (not borders).
  card: '#FFFFFF',
  cardForeground: '#050506',
  text: '#050506',
  textSecondary: 'rgba(5, 5, 6, 0.95)',
  textMuted: 'rgba(5, 5, 6, 0.85)',
  textLight: 'rgba(5, 5, 6, 0.75)',
  textExtraLight: 'rgba(5, 5, 6, 0.65)',
  border: 'rgba(0, 0, 0, 0.1)',
  // Visible against white without feeling harsh.
  borderLight: 'rgba(0, 0, 0, 0.1)',
  borderExtraLight: 'rgba(0, 0, 0, 0.06)',
  input: 'rgba(0, 0, 0, 0.05)',
  price: 'rgba(5, 5, 6, 0.65)',
  comparePrice: 'rgba(5, 5, 6, 0.20)',
  iosLightGray: 'rgba(0, 0, 0, 0.02)',
  iosDarkCard: 'rgba(0, 0, 0, 0.05)',
  glassBg: 'rgba(255, 255, 255, 0.55)',
  glassBorder: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(5, 5, 6, 0.18)',
};

export const darkTheme = {
  ...common,
  primary: '#FFFFFF',
  background: '#000000',
  foreground: '#FFFFFF',
  // Apple Liquid Glass / Black Glass system
  surface: 'rgba(255, 255, 255, 0.05)',
  surfaceElevated: '#0D0D0D',
  card: 'rgba(12, 12, 18, 0.72)',
  cardForeground: '#FFFFFF',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 1.0)',
  textMuted: 'rgba(255, 255, 255, 0.90)',
  textLight: 'rgba(255, 255, 255, 0.80)',
  textExtraLight: 'rgba(255, 255, 255, 0.70)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderLight: 'rgba(255, 255, 255, 0.08)',
  borderExtraLight: 'rgba(255, 255, 255, 0.04)',
  input: 'rgba(255, 255, 255, 0.05)',
  price: 'rgba(255, 255, 255, 0.95)',
  comparePrice: 'rgba(255, 255, 255, 0.35)',
  iosLightGray: 'rgba(255, 255, 255, 0.02)',
  iosDarkCard: 'rgba(255, 255, 255, 0.05)',
  glassBg: 'rgba(12, 12, 18, 0.72)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const lightColors = lightTheme;
export const darkColors = darkTheme;

export const getColors = (theme: 'light' | 'dark') => (
  theme === 'light' ? lightTheme : darkTheme
);

export const useColors = () => {
  const theme = useThemeStore((state) => state.theme);
  return getColors(theme);
};

// Legacy Export for existing components (will be light mode by default)
export const colors = lightColors;
