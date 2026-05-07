/**
 * NotificationService
 *
 * Full push notification support for iOS via Expo Notifications.
 * - Foreground banners (via setNotificationHandler in index.ts)
 * - Lock screen / background notifications (native APNs delivery)
 * - Badge count management
 * - Deep link routing on notification tap
 * - Device token registration with backend
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useNotificationStore } from '../store/notificationStore';
import Constants from 'expo-constants';
import { config } from '../constants/config';
import { haptics } from '../utils/haptics';

// Module-level refs to avoid registering listeners more than once
let _foregroundSub: Notifications.Subscription | null = null;
let _responseSub: Notifications.Subscription | null = null;
let _initialized = false;

function isPhysicalDevice(): boolean {
  // Use Constants as a fallback to avoid native module dependency crashes
  // @ts-ignore
  return Constants.isDevice !== false;
}

/**
 * Lazy auth-state accessor to break circular dependency:
 * authStore -> NotificationService -> authStore
 */
function getAuthUser(): { id?: string } | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useAuthStore } = require('../store/authStore');
  return useAuthStore.getState().user ?? null;
}

export class NotificationService {
  /**
   * Request permissions, configure channels, get push token, and register listeners.
   * Safe to call multiple times — will only run once.
   */
  static async initialize(): Promise<boolean> {
    if (_initialized) return true;

    try {
      if (!isPhysicalDevice()) {
        console.log('[Notifications] Skipping: simulator detected.');
        return false;
      }

      // ── 1. Request permissions ──────────────────────────────────────
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;

      if (existing !== 'granted') {
        // iOS: request alert + sound + badge + provisional (quiet delivery)
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowDisplayInNotificationCenter: true,
            allowDisplayOnLockScreen: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission denied.');
        return false;
      }

      // ── 2. Android channel (iOS does not need channels) ─────────────
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Zica Bella',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#000000',
          showBadge: true,
          sound: 'default',
        });
      }

      // ── 3. Get Expo Push Token and register with backend ─────────────
      try {
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          Constants.easConfig?.projectId;

        if (!projectId) {
          console.warn('[Notifications] No projectId found in app config.');
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });

        if (tokenData?.data) {
          console.log('[Notifications] Push token:', tokenData.data);
          useNotificationStore.getState().setPushToken(tokenData.data);
          await this.registerDevice(tokenData.data);
        }
      } catch (tokenErr) {
        console.warn('[Notifications] Could not get push token:', tokenErr);
        // Non-fatal — app still works, just won't receive remote pushes
      }

      // ── 4. Foreground received listener ─────────────────────────────
      // Remove any stale subscription before registering a new one
      _foregroundSub?.remove();
      _foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
        haptics.success();
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
        // Update badge
        const unread = useNotificationStore.getState().unreadCount();
        Notifications.setBadgeCountAsync(unread).catch(() => {});
      });

      // ── 5. Response listener (notification tapped) ───────────────────
      _responseSub?.remove();
      _responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const notifData = response.notification.request.content.data as Record<string, string>;
        // Mark as read
        const id = String(response.notification.request.identifier).trim();
        useNotificationStore.getState().markAsRead(id);
        // Navigate
        this.handleDeepLink(notifData);
      });

      // ── 6. Sync badge with current unread count ───────────────────────
      const unread = useNotificationStore.getState().unreadCount();
      await Notifications.setBadgeCountAsync(unread);

      _initialized = true;
      console.log('[Notifications] Initialized successfully.');
      return true;
    } catch (err) {
      console.error('[NotificationService] initialize error:', err);
      return false;
    }
  }

  /**
   * Register the device token + userId with the backend so admin
   * dashboard can send targeted pushes.
   */
  static async registerDevice(pushToken?: string, forceUserId?: string) {
    const user = getAuthUser();
    const userId = forceUserId || user?.id;
    const token = pushToken || useNotificationStore.getState().pushToken;

    if (!userId || !token) {
      console.log('[Notifications] Registration skipped: missing userId or token', { userId, hasToken: !!token });
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
          fcmToken: token,        // backend accepts both Expo and FCM tokens
          expoPushToken: token,   // explicit Expo token field
          platform: Platform.OS,
          appVersion: Constants.expoConfig?.version || '1.0.0',
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.warn('[Notifications] Backend registration failed:', err);
      } else {
        console.log('[Notifications] Device registered successfully.');
      }
    } catch (e) {
      console.error('[Notifications] Failed to register device token:', e);
    }
  }

  /**
   * Navigate to the relevant screen based on notification payload.
   * Delayed 500ms so the navigation container has time to mount on cold start.
   */
  static handleDeepLink(data?: Record<string, string>) {
    if (!data) return;

    const { type, id, orderId, productHandle } = data;
    const { navigationRef } = require('../navigation/navigationUtils');

    setTimeout(() => {
      if (!navigationRef.isReady()) return;

      switch (type) {
        case 'order':
        case 'order_update':
        case 'cod_confirmation':
          if (orderId || id) {
            navigationRef.navigate('Main', {
              screen: 'OrdersTab',
            });
            // Small extra delay to let the tab settle
            setTimeout(() => {
              navigationRef.navigate('OrderDetails', { orderId: orderId || id });
            }, 200);
          } else {
            navigationRef.navigate('Main', { screen: 'OrdersTab' });
          }
          break;
        case 'promo':
        case 'product':
          navigationRef.navigate('ProductDetail', { handle: productHandle || id });
          break;
        case 'start_live_activity':
        case 'live_activity_update':
          navigationRef.navigate('Main', { screen: 'OrdersTab' });
          break;
        default:
          // Generic — just open app to home
          navigationRef.navigate('Main', { screen: 'HomeTab' });
          break;
      }
    }, 500);
  }

  /**
   * Re-register after login (token already obtained, just need userId).
   */
  static async onLogin(userId: string) {
    await this.registerDevice(undefined, userId);
  }

  /**
   * Reset initialization state (call on logout so next login re-registers).
   */
  static reset() {
    _initialized = false;
  }
}
