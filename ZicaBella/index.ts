/**
 * App Entry Point
 *
 * Sets the global foreground notification handler ONLY here.
 * All listener registration (received, response) is done in NotificationService.initialize()
 * to avoid duplicate listeners causing duplicate-key crashes.
 */
import { suppressProductionLogs } from './src/utils/logger';
import * as Notifications from 'expo-notifications';
import { registerRootComponent } from 'expo';
import App from './App';

// ─── CRITICAL: Suppress console output in production to prevent PII leaks ───
suppressProductionLogs();

// ─── CRITICAL: Configure how notifications behave when app is in foreground ───
// This MUST be set at the module level before anything else.
// shouldShowAlert: true  → shows banner/lock screen style alert in foreground
// shouldPlaySound: true  → plays notification sound
// shouldSetBadge: true   → updates app icon badge
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
registerRootComponent(App);
