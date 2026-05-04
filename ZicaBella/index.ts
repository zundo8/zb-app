import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import { useNotificationStore } from './src/store/notificationStore';
import App from './App';

// Handle background messages
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
  // Add to store even in background
  if (remoteMessage.messageId) {
    useNotificationStore.getState().addNotification({
      id: remoteMessage.messageId,
      title: remoteMessage.notification?.title || 'Zica Bella',
      body: remoteMessage.notification?.body || '',
      date: new Date().toISOString(),
      isRead: false,
      data: remoteMessage.data || {}
    });
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
