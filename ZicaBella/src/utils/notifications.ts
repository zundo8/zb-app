import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

import Constants from 'expo-constants';

export const initPushNotifications = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    // Get the Expo push token
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      console.log('[Notifications] Expo push token:', tokenData.data);
    } catch (tokenErr) {
      console.warn('[Notifications] Could not get push token:', tokenErr);
    }

    // Foreground handler is already set above via setNotificationHandler
  } catch (err) {
    console.warn('[Notifications] Error during init:', err);
  }
};
