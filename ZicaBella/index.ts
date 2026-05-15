import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import * as Notifications from 'expo-notifications';
import App from './App';

// ─── CRITICAL: Configure how notifications behave when app is in foreground ───
// This MUST be set at the module level before any other notification logic.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn('Notification handler setup failed:', e);
}

try {
  registerRootComponent(App);
} catch (e) {
  console.error('App registration failed:', e);
}
