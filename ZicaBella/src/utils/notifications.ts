import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { config } from '../constants/config';

/**
 * Resolve the EAS project ID from Constants.
 */
export function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

/**
 * Register for push notifications and return BOTH Expo and Native tokens.
 */
export async function registerForPushNotifications(): Promise<{
  expoToken?: string;
  deviceToken?: string;
} | undefined> {
  if (!Device.isDevice || Platform.OS === 'web') {
    console.warn('[Notifications] Push notifications require a physical iOS device.');
    return undefined;
  }

  try {
    // 1. Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowDisplayInCarPlay: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted.');
      return undefined;
    }

    let expoToken: string | undefined;
    let deviceToken: string | undefined;

    // 2. Get Expo Push Token
    const projectId = getExpoProjectId();
    if (projectId && projectId !== 'your-eas-project-id') {
      try {
        const expoData = await Notifications.getExpoPushTokenAsync({ projectId });
        expoToken = expoData?.data;
      } catch (err) {
        console.warn('[Notifications] Expo token fetch failed:', err);
      }
    }

    // 3. Get Native Device Token (The direct address for APNs)
    if (Platform.OS === 'ios') {
      try {
        const nativeData = await Notifications.getDevicePushTokenAsync();
        deviceToken = typeof nativeData.data === 'string' 
          ? nativeData.data 
          : JSON.stringify(nativeData.data);
      } catch (err) {
        console.warn('[Notifications] Native token fetch failed:', err);
      }
    }

    console.log('[Notifications] Registration successful:', { expoToken, deviceToken });
    return { expoToken, deviceToken };
  } catch (err) {
    console.warn('[Notifications] Error during registration:', err);
    return undefined;
  }
}

/**
 * Send tokens to the backend.
 */
export async function postPushTokenToBackend(
  tokens: { expoToken?: string; deviceToken?: string },
  userId: string
): Promise<boolean> {
  try {
    const primaryToken = tokens.deviceToken || tokens.expoToken;
    const tokenType = tokens.deviceToken ? 'apns' : 'expo';

    if (!primaryToken) {
      return false;
    }

    const payload = {
      userId,
      expoToken: tokens.expoToken,
      expoPushToken: tokens.expoToken,
      deviceToken: tokens.deviceToken,
      apnsToken: tokens.deviceToken,
      pushToken: primaryToken,
      token: primaryToken,
      tokenType,
      pushProvider: tokenType,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version || '1.0.0',
    };

    // Use the primary registration endpoint
    const response = await fetch(`${config.appUrl}/api/notifications/register-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        deviceId: `ios_${userId}`,
        fcmToken: primaryToken, // Backward-compatible legacy field name.
      }),
    });

    // Also notify the simplified endpoint
    fetch(`${config.appUrl}/api/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});

    return response.ok;
  } catch (err) {
    console.warn('[Notifications] Failed to sync tokens with backend:', err);
    return false;
  }
}
