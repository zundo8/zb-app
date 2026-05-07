import React, { useEffect, useMemo } from 'react';
import { NavigationContainer, createNavigationContainerRef, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { View } from 'react-native';

import { useThemeStore } from '../store/themeStore';
import { getColors, useColors, lightColors, darkColors } from '../constants/colors';
import { useUIStore } from '../store/uiStore';

import { useAuthStore } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import CheckoutNavigator from './CheckoutNavigator';
import ServiceNavigator from './ServiceNavigator';
import OrderConfirmationScreen from '../screens/OrderConfirmationScreen';
import OrderDetailsScreen from '../screens/OrderDetailsScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import { withErrorBoundary } from '../components/ErrorBoundary';
import { RootStackParamList } from './types';
import { navigationRef } from './navigationUtils';

import CartDrawer from '../components/CartDrawer';
import BookmarkDrawer from '../components/BookmarkDrawer';
import MenuDrawer from '../components/MenuDrawer';

const SafeOrderConfirmation = withErrorBoundary(OrderConfirmationScreen, 'OrderConfirmation');
const SafeProductDetail = withErrorBoundary(ProductDetailScreen, 'ProductDetail');

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: ['zicabella://', 'https://app.zicabella.com'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
        },
      },
      Main: {
        screens: {
          HomeTab: '',
          SearchTab: 'search',
          ShopTab: 'shop',
          OrdersTab: 'orders',
          ProfileTab: 'profile',
        },
      },
      ProductDetail: 'products/:handle',
      CheckoutFlow: 'checkout',
      OrderConfirmation: 'order-confirmation',
    },
  },
};

export const RootNavigator = () => {
  const { 
    isCartOpen, setCartOpen, 
    isBookmarkOpen, setBookmarkOpen,
    isMenuOpen, setMenuOpen 
  } = useUIStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let lastMagnitude: number | null = null;
    let lastShakeAt = 0;

    Accelerometer.setUpdateInterval(100);
    subscription = Accelerometer.addListener((data) => {
      const { x, y, z } = data;
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      if (lastMagnitude == null) {
        lastMagnitude = magnitude;
        return;
      }

      const delta = Math.abs(magnitude - lastMagnitude);
      lastMagnitude = magnitude;

      const now = Date.now();
      const COOLDOWN_MS = 1200;
      const SHAKE_THRESHOLD = 1.8; // More intentional shake

      if (delta > SHAKE_THRESHOLD && now - lastShakeAt > COOLDOWN_MS) {
        lastShakeAt = now;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCartOpen(!useUIStore.getState().isCartOpen);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const themeStr = useThemeStore((state) => state.theme);
  const colors = useColors();
  const isDark = themeStr === 'dark';

  const navigationTheme = useMemo(() => {
    const palette = getColors(themeStr as 'light' | 'dark');
    const baseTheme = isDark ? DarkTheme : DefaultTheme;
    
    return {
      ...baseTheme,
      dark: isDark,
      colors: {
        ...baseTheme.colors,
        primary: palette.primary || '#000000',
        background: palette.background || '#FFFFFF',
        card: palette.card || '#FFFFFF',
        text: palette.text || '#000000',
        border: palette.border || 'rgba(0,0,0,0.1)',
        notification: palette.badge || '#FF0000',
      },
    };
  }, [isDark, themeStr]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationContainer ref={navigationRef} linking={linking as any} theme={navigationTheme}>
        <Stack.Navigator id="RootStackNavigator" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="Main" component={TabNavigator} />
          {!isAuthenticated && (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          )}
          
          <Stack.Screen name="CheckoutFlow" component={CheckoutNavigator} />
          <Stack.Screen name="ServiceFlow" component={ServiceNavigator} />
          <Stack.Screen name="OrderConfirmation" component={SafeOrderConfirmation} />
          <Stack.Screen name="OrderDetails" component={OrderDetailsScreen as any} />
          <Stack.Screen name="ProductDetail" component={SafeProductDetail} />
        </Stack.Navigator>

        {/* ── GLOBAL UI OVERLAYS ── */}
        <CartDrawer 
          visible={isCartOpen} 
          onClose={() => setCartOpen(false)} 
          onCheckout={() => {
            setCartOpen(false);
            // @ts-ignore
            navigationRef.current?.navigate('CheckoutFlow');
          }}
        />
        <BookmarkDrawer
          visible={isBookmarkOpen}
          onClose={() => setBookmarkOpen(false)}
        />
        <MenuDrawer
          visible={isMenuOpen}
          onClose={() => setMenuOpen(false)}
        />
      </NavigationContainer>
    </View>
  );
};

export default RootNavigator;
