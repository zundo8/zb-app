/**
 * App Entry Point
 *
 * @react-native-firebase auto-initialises the native Firebase app from
 * GoogleService-Info.plist (iOS) / google-services.json (Android) before any
 * JS code runs, so we never need to call firebase.initializeApp() here.
 */
import '@react-native-firebase/app'; // ensure native module is linked
import messaging from '@react-native-firebase/messaging';
import { useNotificationStore } from './src/store/notificationStore';
import { registerRootComponent } from 'expo';
import App from './App';

// Register background message handler — must be called before registerRootComponent
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[FCM] Background message:', remoteMessage.messageId);
  if (remoteMessage.messageId) {
    useNotificationStore.getState().addNotification({
      id: remoteMessage.messageId,
      title: remoteMessage.notification?.title || 'Zica Bella',
      body: remoteMessage.notification?.body || '',
      date: new Date().toISOString(),
      isRead: false,
      data: (remoteMessage.data as Record<string, string>) || {},
    });
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
registerRootComponent(App);
