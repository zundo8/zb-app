/**
 * NotificationService
 *
 * Handles FCM push notifications using @react-native-firebase/messaging.
 * The Firebase app is auto-initialized natively from GoogleService-Info.plist,
 * so no manual initializeApp() call is required here.
 */
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { config } from '../constants/config';
import { haptics } from '../utils/haptics';

export class NotificationService {
  /**
   * Request permissions and initialize FCM listeners.
   * Call this inside a React component after the app mounts (e.g. App.tsx useEffect).
   */
  static async initialize(): Promise<boolean> {
    try {
      // Request permission on iOS
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

        if (!enabled) {
          console.log('[FCM] Permission denied by user');
          return false;
        }
      }

      // Get and register FCM token
      try {
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
          await this.registerDevice(fcmToken);
        }
      } catch (tokenErr) {
        console.warn('[FCM] Could not get token (GoogleService-Info.plist may be a placeholder):', tokenErr);
      }

      // Refresh token listener
      messaging().onTokenRefresh(async (token) => {
        await this.registerDevice(token);
      });

      // Foreground message listener
      messaging().onMessage(async (remoteMessage) => {
        haptics.success();
        useNotificationStore.getState().addNotification({
          id: remoteMessage.messageId || Date.now().toString(),
          title: remoteMessage.notification?.title || 'Zica Bella',
          body: remoteMessage.notification?.body || '',
          date: new Date().toISOString(),
          isRead: false,
          data: (remoteMessage.data as Record<string, string>) || {},
        });
      });

      // Notification tapped while app was in background
      messaging().onNotificationOpenedApp((remoteMessage) => {
        this.handleDeepLink(remoteMessage.data as Record<string, string>);
      });

      // Notification tapped while app was quit (cold start)
      messaging()
        .getInitialNotification()
        .then((remoteMessage) => {
          if (remoteMessage) {
            this.handleDeepLink(remoteMessage.data as Record<string, string>);
          }
        })
        .catch((err) => console.warn('[FCM] getInitialNotification error:', err));

      return true;
    } catch (err) {
      console.error('[NotificationService] initialize error:', err);
      return false;
    }
  }

  static async registerDevice(fcmToken: string) {
    const user = useAuthStore.getState().user;
    if (!user?.id) return;

    try {
      const deviceId = `dev_${Platform.OS}_${user.id}`;
      await fetch(`${config.appUrl}/api/notifications/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          deviceId,
          fcmToken,
          platform: Platform.OS,
          appVersion: '1.0.0',
        }),
      });
    } catch (e) {
      console.error('[FCM] Failed to register device token:', e);
    }
  }

  static handleDeepLink(data?: Record<string, string>) {
    if (!data) return;

    const { type, id } = data;
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
        case 'cod_confirmation':
          navigationRef.navigate('Main', { screen: 'OrdersTab' });
          break;
      }
    }, 500);
  }
}
