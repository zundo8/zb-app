/**
 * App Entry Point
 *
 * Uses Expo Notifications for push notification handling.
 * Firebase native modules have been removed to eliminate iOS init crashes.
 */
import * as Notifications from 'expo-notifications';
import { useNotificationStore } from './src/store/notificationStore';
import { registerRootComponent } from 'expo';
import App from './App';

// Configure notification handler for foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as any),
});

// Listen for notifications received while app is backgrounded/killed
// and store them so they appear in the Notifications screen
Notifications.addNotificationReceivedListener((notification) => {
  const { title, body, data } = notification.request.content;
  useNotificationStore.getState().addNotification({
    id: notification.request.identifier || Date.now().toString(),
    title: title || 'Zica Bella',
    body: body || '',
    date: new Date().toISOString(),
    isRead: false,
    data: (data as Record<string, string>) || {},
  });
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
registerRootComponent(App);
