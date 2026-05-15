import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { config } from '../constants/config';

/**
 * Resolve the EAS project ID from Constants.
 * The SDK looks in Constants.expoConfig.extra.eas.projectId first,
 * then falls back to Constants.easConfig.projectId (set automatically
 * in EAS builds).
 */
export function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * Register for push notifications and return a push token string.
 *
 * Strategy:
 * 1. Verify we're on a physical device
 * 2. Request notification permissions (iOS: alert + sound + badge)
 * 3. Try to get an Expo push token (requires EAS projectId)
 * 4. If Expo token fails, fall back to the native APNs device token
 *
 * Returns an object with the token string and its type, or undefined if all fail.
 */
export async function registerForPushNotifications(): Promise<{
  token: string;
  type: 'expo' | 'native';
} | undefined> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn('[Notifications] Push notifications require a physical device.');
    return undefined;
  }

  // Skip on web
  if (Platform.OS === 'web') return undefined;

  try {
    // 1. Check / request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted.');
      return undefined;
    }

    // 2. Try Expo push token first (requires EAS projectId + Expo account)
    const projectId = getExpoProjectId();
    if (projectId && projectId !== 'your-eas-project-id') {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        if (tokenData?.data) {
          console.log('[Notifications] Expo push token:', tokenData.data);
          return { token: tokenData.data, type: 'expo' };
        }
      } catch (expoErr) {
        console.warn('[Notifications] Expo token failed, falling back to native APNs:', expoErr);
      }
    }

    // 3. Fallback: get the native APNs device token directly
    // This works without EAS projectId and can be delivered via our backend's direct APNs path
    if (Platform.OS === 'ios') {
      try {
        const nativeToken = await Notifications.getDevicePushTokenAsync();
        if (nativeToken?.data) {
          const tokenStr = typeof nativeToken.data === 'string'
            ? nativeToken.data
            : JSON.stringify(nativeToken.data);
          console.log('[Notifications] Native APNs device token:', tokenStr);
          return { token: tokenStr, type: 'native' };
        }
      } catch (nativeErr) {
        console.warn('[Notifications] Native APNs token failed:', nativeErr);
      }
    }

    console.warn('[Notifications] Could not obtain any push token.');
    return undefined;
  } catch (err) {
    console.warn('[Notifications] Error during registration:', err);
    return undefined;
  }
}

/**
 * POST the push token to the backend so the admin dashboard can send
 * targeted notifications to this user/device.
 *
 * Sends to both endpoints:
 * - /api/push-token (simplified)
 * - /api/notifications/register-device (detailed, with platform & device info)
 */
export async function postPushTokenToBackend(
  token: string,
  userId: string,
  tokenType: 'expo' | 'native' = 'expo'
): Promise<boolean> {
  try {
    // Simplified endpoint
    const res1 = fetch(`${config.appUrl}/api/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token }),
    }).catch(() => null);

    // Detailed endpoint with device metadata
    const deviceId = `${tokenType}_${Platform.OS}_${userId}`;
    const res2 = fetch(`${config.appUrl}/api/notifications/register-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        deviceId,
        fcmToken: token,
        expoPushToken: tokenType === 'expo' ? token : undefined,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || '1.0.0',
      }),
    }).catch(() => null);

    const [r1, r2] = await Promise.all([res1, res2]);
    return (r1?.ok || r2?.ok) ?? false;
  } catch (err) {
    console.warn('[Notifications] Failed to register token with backend:', err);
    return false;
  }
}
