import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { config } from '../constants/config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);
  const addNotification = useNotificationStore(s => s.addNotification);
  const setPushToken = useNotificationStore(s => s.setPushToken);

  const authToken = useAuthStore(s => s.token);

  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) {
        setPushToken(token);
        // Register token with backend
        registerTokenWithBackend(token);
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        const { title, body } = notification.request.content;
        const data = notification.request.content.data as any;
        
        addNotification({
          id: notification.request.identifier,
          title: title || 'New Notification',
          body: body || '',
          date: new Date().toISOString(),
          isRead: false,
          data: data || {}
        });
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [authToken]);
}

async function registerTokenWithBackend(token: string) {
  try {
    const authToken = useAuthStore.getState().token;
    await fetch(`${config.apiUrl}/api/app/notifications/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({
        token,
        deviceId: Device.osBuildId || Device.modelName || 'unknown',
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || '1.0.0'
      })
    });
  } catch (e) {
    console.error('Failed to register token with backend:', e);
  }
}

async function registerForPushNotifications() {
  if (Platform.OS === 'web') return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'your-actual-project-id-if-not-in-config';
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    console.log('Push token:', token.data);
    return token.data;
  } catch (error) {
    console.log('Error getting push token:', error);
  }
}
