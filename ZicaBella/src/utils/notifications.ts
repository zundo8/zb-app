import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

export const initPushNotifications = async () => {
  try {
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

    if (finalStatus !== 'granted') return undefined;

    const projectId = getExpoProjectId();
    if (!projectId) {
      console.warn('[Notifications] Missing EAS projectId. Add expo.extra.eas.projectId in app.json.');
      return undefined;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[Notifications] Expo push token:', tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.warn('[Notifications] Error during init:', err);
    return undefined;
  }
};
