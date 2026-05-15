import React, { useEffect, useRef } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';

import RootNavigator from './src/navigation/RootNavigator';
import { ConsentModal } from './src/components/ConsentModal';
import { useThemeStore } from './src/store/themeStore';
import { suppressProductionLogs } from './src/utils/logger';
import { useFonts } from 'expo-font';
import { getColors } from './src/constants/colors';
import { NotificationService } from './src/services/NotificationService';
import { InAppNotificationBanner } from './src/components/InAppNotificationBanner';
import { registerForPushNotifications, postPushTokenToBackend } from './src/utils/notifications';
import { useAuthStore } from './src/store/authStore';
import { useNotificationStore } from './src/store/notificationStore';

// Sentry initialization is disabled during local development to prevent Expo Go native module crashes.
// It will be enabled in the final EAS build.


// Keep the splash screen visible while we fetch resources if needed
SplashScreen.preventAutoHideAsync().catch(() => {});

function App() {
  const [fontsLoaded] = useFonts({
    'Rocaston': require('./assets/fonts/Rocaston.ttf'),
  });

  const theme = useThemeStore(state => state.theme);
  const isDark = theme === 'dark';
  const colors = getColors(theme);
  const userId = useAuthStore(state => state.user?.id);

  // Refs for notification listeners to avoid duplicates
  const notificationReceivedRef = useRef<Notifications.Subscription | null>(null);
  const notificationResponseRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    suppressProductionLogs();
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
      NotificationService.initialize();
    }
  }, [fontsLoaded]);

  // ── Push token registration ──────────────────────────────────────────────
  // Whenever the authenticated user changes, re-register the push token.
  useEffect(() => {
    if (!fontsLoaded) return;

    (async () => {
      const tokens = await registerForPushNotifications();
      if (tokens) {
        const primaryToken = tokens.deviceToken || tokens.expoToken;
        if (primaryToken) {
          useNotificationStore.getState().setPushToken(primaryToken);
          // If user is logged in, associate tokens with their userId
          if (userId) {
            postPushTokenToBackend(tokens, userId);
          }
        }
      }
    })();
  }, [fontsLoaded, userId]);

  // ── Notification listeners ───────────────────────────────────────────────
  useEffect(() => {
    // Foreground: notification received while app is open
    notificationReceivedRef.current?.remove();
    notificationReceivedRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body, data } = notification.request.content;
        const id = String(notification.request.identifier || Date.now()).trim();
        useNotificationStore.getState().addNotification({
          id,
          title: title || 'Zica Bella',
          body: body || '',
          date: new Date().toISOString(),
          isRead: false,
          data: (data as Record<string, string>) || {},
        });
        // Sync badge count
        const unread = useNotificationStore.getState().unreadCount();
        Notifications.setBadgeCountAsync(unread).catch(() => {});
      }
    );

    // Response: user tapped on a notification
    notificationResponseRef.current?.remove();
    notificationResponseRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { data } = response.notification.request.content;
        const notifData = data as Record<string, string> | undefined;

        // Navigate to order detail if orderId is present
        if (notifData?.orderId) {
          NotificationService.handleDeepLink({
            ...notifData,
            type: notifData.type || 'order',
            orderId: notifData.orderId,
          });
        } else if (notifData) {
          NotificationService.handleDeepLink(notifData);
        }
      }
    );

    return () => {
      notificationReceivedRef.current?.remove();
      notificationResponseRef.current?.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar 
          barStyle={isDark ? "light-content" : "dark-content"} 
          backgroundColor={colors.background}
          translucent 
        />
        <InAppNotificationBanner />
        <RootNavigator />
        <ConsentModal />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
