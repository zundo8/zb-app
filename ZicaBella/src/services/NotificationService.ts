/**
 * NotificationService
 *
 * Handles push notifications using Expo Notifications.
 * Firebase has been removed — this uses Expo's push token system instead.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNotificationStore } from '../store/notificationStore';
import Constants from 'expo-constants';
import { config } from '../constants/config';
import { haptics } from '../utils/haptics';

/**
 * Check if running on a physical device without requiring the expo-device native module.
 * expo-device requires a native rebuild which crashes Expo Go / dev-client builds
 * that haven't been prebuilt with it.
 *
 * Uses Constants.executionEnvironment from expo-constants (always available).
 * - 'storeClient' = Expo Go → typically simulator/device but can't get APNs
 * - 'standalone' / 'bare' = production or dev-client → check further
 *
 * Falls back to `true` so real devices still attempt push registration.
 */
function isPhysicalDevice(): boolean {
  // Safe heuristic from expo-constants (always available)
  // @ts-ignore
  if (Constants.isDevice === false) return false;
  return true;
}

/**
 * Lazy auth-state accessor — avoids circular import:
 *   authStore -> NotificationService -> authStore
 * By deferring the require() to call time we break the module-load cycle.
 */
function getAuthUser(): { id?: string } | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useAuthStore } = require('../store/authStore');
  return useAuthStore.getState().user ?? null;
}

export class NotificationService {
  /**
   * Request permissions and initialize notification listeners.
   * Call this inside a React component after the app mounts (e.g. App.tsx useEffect).
   */
  static async initialize(): Promise<boolean> {
    try {
      // Push notifications only work on real physical devices, never simulators.
      if (!isPhysicalDevice()) {
        console.log('[Notifications] Push notifications require a physical device — skipping on simulator.');
        return false;
      }

      // Request permission on iOS
      if (Platform.OS === 'ios') {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[Notifications] Permission denied by user');
          return false;
        }
      }

      // Get and register push token
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        if (tokenData?.data) {
          useNotificationStore.getState().setPushToken(tokenData.data);
          await this.registerDevice(tokenData.data);
        }
      } catch (tokenErr) {
        console.warn('[Notifications] Could not get push token:', tokenErr);
      }

      // Foreground notification listener
      Notifications.addNotificationReceivedListener((notification) => {
        haptics.success();
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

      // Notification tapped listener (handles both background and cold start)
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, string>;
        this.handleDeepLink(data);
      });

      return true;
    } catch (err) {
      console.error('[NotificationService] initialize error:', err);
      return false;
    }
  }

  static async registerDevice(pushToken?: string, forceUserId?: string) {
    // Use lazy require to avoid circular dependency with authStore.
    const user = getAuthUser();
    const userId = forceUserId || user?.id;
    const token = pushToken || useNotificationStore.getState().pushToken;

    if (!userId || !token) {
       console.log('[Notifications] Registration skipped: missing userId or token', { userId, token });
       return;
    }

    try {
      const deviceId = `dev_${Platform.OS}_${userId}`;
      const response = await fetch(`${config.appUrl}/api/notifications/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          deviceId,
          fcmToken: token,
          platform: Platform.OS,
          appVersion: '1.0.0',
        }),
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.warn('[Notifications] Backend registration failed:', err);
      } else {
        console.log('[Notifications] Device registered successfully');
      }
    } catch (e) {
      console.error('[Notifications] Failed to register device token:', e);
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
