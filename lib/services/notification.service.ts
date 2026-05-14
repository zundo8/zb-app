import admin from 'firebase-admin';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import db from '../db';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// Initialize Expo SDK
const expo = new Expo();

export const NotificationService = {
  /**
   * Registers or updates a device token for a user
   */
  async registerDeviceToken(data: { userId: string; deviceId: string; fcmToken: string; platform?: string; appVersion?: string }) {
    return db.deviceToken.upsert({
      where: {
        userId_deviceId: {
          userId: data.userId,
          deviceId: data.deviceId,
        },
      },
      update: {
        fcmToken: data.fcmToken,
        platform: data.platform || 'ios',
        appVersion: data.appVersion,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        userId: data.userId,
        deviceId: data.deviceId,
        fcmToken: data.fcmToken,
        platform: data.platform || 'ios',
        appVersion: data.appVersion,
        isActive: true,
      },
    });
  },

  /**
   * Soft deletes a device token
   */
  async unregisterDevice(userId: string, deviceId: string) {
    return db.deviceToken.update({
      where: {
        userId_deviceId: { userId, deviceId },
      },
      data: { isActive: false },
    });
  },

  /**
   * Sends a notification to a specific user
   */
  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    const devices = await db.deviceToken.findMany({
      where: { userId, isActive: true },
    });

    if (devices.length === 0) {
      return { success: false, reason: 'No active devices found.' };
    }

    const tokens = devices.map(d => d.fcmToken);
    return this.sendToTokens(tokens, title, body, data);
  },

  /**
   * Send notification to an array of tokens (handles both FCM and Expo)
   */
  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>) {
    if (tokens.length === 0) return { success: true, successCount: 0, failureCount: 0 };

    const expoTokens: string[] = [];
    const fcmTokens: string[] = [];

    tokens.forEach(token => {
      if (Expo.isExpoPushToken(token)) {
        expoTokens.push(token);
      } else {
        fcmTokens.push(token);
      }
    });

    let successCount = 0;
    let failureCount = 0;

    // --- Process Expo Tokens ---
    if (expoTokens.length > 0) {
      const messages: ExpoPushMessage[] = expoTokens.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: data as any,
        badge: 1,
        priority: 'high',
        channelId: 'default',
        mutableContent: true,
        categoryIdentifier: 'default',
      }));

      const chunks = expo.chunkPushNotifications(messages);
      const chunkPromises = chunks.map(async (chunk) => {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          ticketChunk.forEach((ticket: any, idx: number) => {
            if (ticket.status === 'ok') {
              successCount++;
            } else {
              failureCount++;
              console.error(`Expo send error: ${ticket.details?.error}`);
              if (ticket.details?.error === 'DeviceNotRegistered') {
                // Cleanup stale token
                db.deviceToken.updateMany({
                  where: { fcmToken: chunk[idx].to as string },
                  data: { isActive: false }
                }).catch(() => {});
              }
            }
          });
        } catch (error) {
          console.error('Expo chunk send error:', error);
          failureCount += chunk.length;
        }
      });
      
      await Promise.all(chunkPromises);
    }

    // --- Process FCM Tokens ---
    if (fcmTokens.length > 0) {
      // Firebase limits to 500 tokens per multicast
      for (let i = 0; i < fcmTokens.length; i += 500) {
        const chunk = fcmTokens.slice(i, i + 500);
        const message: admin.messaging.MulticastMessage = {
          notification: { title, body, imageUrl: (data as any)?.imageUrl || undefined },
          data: data as any,
          tokens: chunk,
          android: { priority: 'high' },
          apns: {
            payload: {
              aps: { 
                sound: 'default', 
                badge: 1, 
                'content-available': 1, 
                mutableContent: true,
                category: 'default'
              }
            },
            headers: { 'apns-priority': '10' }
          },
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(message);
          successCount += response.successCount;
          failureCount += response.failureCount;

          // Cleanup stale FCM tokens
          const tokensToRemove: string[] = [];
          response.responses.forEach((res, idx) => {
            if (!res.success && (res.error?.code === 'messaging/invalid-registration-token' || res.error?.code === 'messaging/registration-token-not-registered')) {
              tokensToRemove.push(chunk[idx]);
            }
          });

          if (tokensToRemove.length > 0) {
            await db.deviceToken.updateMany({
              where: { fcmToken: { in: tokensToRemove } },
              data: { isActive: false }
            }).catch(() => {});
          }
        } catch (err) {
          console.error('FCM multicast error:', err);
          failureCount += chunk.length;
        }
      }
    }

    return { success: true, successCount, failureCount };
  }
};
