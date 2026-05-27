import 'react-native-gesture-handler';
import { LogBox } from 'react-native';

// Suppress deprecation warnings from third-party libraries (e.g. Three.js / React Three Fiber)
LogBox.ignoreLogs([
  'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
  'THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
]);

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
