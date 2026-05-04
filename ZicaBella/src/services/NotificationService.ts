import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { config } from '../constants/config';
import { haptics } from '../utils/haptics';

export class NotificationService {
  /**
   * Request permissions and initialize FCM
   */
  static async initialize() {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission({
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        provisional: false,
        sound: true,
      });

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) return false;
    }

    // Get FCM token
    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      await this.registerDevice(fcmToken);
    }

    // Listen to token refresh
    messaging().onTokenRefresh(async (token) => {
      await this.registerDevice(token);
    });

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      haptics.notificationSuccess();
      
      // Update badge
      const unreadCount = useNotificationStore.getState().unreadCount() + 1;
      messaging().setBadgeCount(unreadCount);

      // Add to store
      useNotificationStore.getState().addNotification({
        id: remoteMessage.messageId || Date.now().toString(),
        title: remoteMessage.notification?.title || 'Zica Bella',
        body: remoteMessage.notification?.body || '',
        date: new Date().toISOString(),
        isRead: false,
        data: remoteMessage.data || {}
      });

      // You can also show a custom in-app banner here via a UI store or event emitter
    });

    // Handle background app open
    messaging().onNotificationOpenedApp((remoteMessage) => {
      this.handleDeepLink(remoteMessage.data);
    });

    // Handle cold start app open
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          this.handleDeepLink(remoteMessage.data);
        }
      });

    // Clear badge on open
    messaging().setBadgeCount(0);
    return true;
  }

  static async registerDevice(fcmToken: string) {
    const user = useAuthStore.getState().user;
    if (!user?.id) return;

    try {
      // In a real app, you'd want a consistent device ID, e.g. using react-native-device-info
      const deviceId = `dev_${Platform.OS}_${Date.now()}`; // Simplified for this example

      await fetch(`${config.appUrl}/api/notifications/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          deviceId,
          fcmToken,
          platform: Platform.OS,
          appVersion: '1.0.0'
        }),
      });
    } catch (e) {
      console.error('Failed to register device token', e);
    }
  }

  static handleDeepLink(data?: { [key: string]: string }) {
    if (!data) return;
    
    const { type, id } = data;
    // Assuming you have a navigation ref exported somewhere to use outside of React components
    // import { navigationRef } from '../navigation/navigationUtils';
    
    const { navigationRef } = require('../navigation/navigationUtils');

    setTimeout(() => {
      if (!navigationRef.isReady()) return;

      switch (type) {
        case 'order':
        case 'order_update':
          navigationRef.navigate('OrderDetail', { orderForDetail: { shopifyOrderId: id } });
          break;
        case 'promo':
        case 'product':
          navigationRef.navigate('ProductDetail', { handle: id });
          break;
        case 'start_live_activity':
        case 'live_activity_update':
          navigationRef.navigate('Main', { screen: 'OrdersTab' });
          break;
        case 'cod_confirmation':
          // could open a specific modal or go to orders
          navigationRef.navigate('Main', { screen: 'OrdersTab' });
          break;
      }
    }, 500);
  }
}
